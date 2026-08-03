
-- =========================================================================
-- BIBLIOTECA DIGITAL ESCOTEIRA — FASE 1
-- =========================================================================

-- Folders
CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_folders TO authenticated;
GRANT ALL ON public.document_folders TO service_role;
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

-- Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  filename text NOT NULL,
  extension text,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL UNIQUE,
  checksum text,
  category text,
  visibility text NOT NULL DEFAULT 'roles' CHECK (visibility IN ('public','roles','specific','private')),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  scout_id uuid REFERENCES public.scouts(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  download_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_folder ON public.documents(folder_id);
CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_event ON public.documents(event_id);
CREATE INDEX idx_documents_scout ON public.documents(scout_id);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Role permissions per document
CREATE TABLE public.document_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_download boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_share boolean NOT NULL DEFAULT false,
  can_upload boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, role)
);

CREATE INDEX idx_doc_role_perm_document ON public.document_role_permissions(document_id);
CREATE INDEX idx_doc_role_perm_role ON public.document_role_permissions(role);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_role_permissions TO authenticated;
GRANT ALL ON public.document_role_permissions TO service_role;
ALTER TABLE public.document_role_permissions ENABLE ROW LEVEL SECURITY;

-- Access logs
CREATE TABLE public.document_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('view','download','upload','edit','delete','share','preview')),
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_access_document ON public.document_access_logs(document_id);
CREATE INDEX idx_doc_access_user ON public.document_access_logs(user_id);
CREATE INDEX idx_doc_access_created ON public.document_access_logs(created_at DESC);

GRANT SELECT, INSERT ON public.document_access_logs TO authenticated;
GRANT ALL ON public.document_access_logs TO service_role;
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- ACCESS FUNCTION (SECURITY DEFINER — avoids RLS recursion)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.can_access_document(
  _user_id uuid,
  _document_id uuid,
  _action text DEFAULT 'view'
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.documents WHERE id = _document_id)
    AND (
      -- Admin sempre pode
      public.has_role(_user_id, 'admin'::app_role)
      -- Uploader tem controle total
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = _document_id AND d.uploaded_by = _user_id
      )
      -- Documento público (qualquer autenticado)
      OR (
        _action IN ('view','download','preview')
        AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = _document_id AND d.visibility = 'public')
      )
      -- Permissão por papel
      OR EXISTS (
        SELECT 1 FROM public.document_role_permissions drp
        JOIN public.user_roles ur ON ur.role = drp.role
        WHERE drp.document_id = _document_id
          AND ur.user_id = _user_id
          AND (
            (_action = 'view' AND drp.can_view)
            OR (_action = 'preview' AND drp.can_view)
            OR (_action = 'download' AND drp.can_download)
            OR (_action = 'edit' AND drp.can_edit)
            OR (_action = 'delete' AND drp.can_delete)
            OR (_action = 'share' AND drp.can_share)
          )
      )
    );
$$;

-- Helper: can_upload_documents (por papel — checa se existe qualquer role_permission com can_upload)
CREATE OR REPLACE FUNCTION public.can_upload_documents(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL AND (
      public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'diretor_presidente'::app_role)
      OR public.has_role(_user_id, 'diretor_administrativo'::app_role)
      OR public.has_role(_user_id, 'diretor_financeiro'::app_role)
      OR public.has_role(_user_id, 'chefe'::app_role)
      OR public.has_role(_user_id, 'dirigente_gestor'::app_role)
      OR public.has_role(_user_id, 'dirigente'::app_role)
    );
$$;

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- document_folders: todos autenticados podem listar; só quem pode fazer upload cria; admin edita/exclui
CREATE POLICY "folders_select_authenticated" ON public.document_folders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "folders_insert_uploaders" ON public.document_folders
  FOR INSERT TO authenticated
  WITH CHECK (public.can_upload_documents(auth.uid()));

CREATE POLICY "folders_update_admin" ON public.document_folders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

CREATE POLICY "folders_delete_admin" ON public.document_folders
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND NOT is_system);

-- documents
CREATE POLICY "documents_select_authorized" ON public.documents
  FOR SELECT TO authenticated
  USING (public.can_access_document(auth.uid(), id, 'view'));

CREATE POLICY "documents_insert_uploaders" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.can_upload_documents(auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "documents_update_authorized" ON public.documents
  FOR UPDATE TO authenticated
  USING (public.can_access_document(auth.uid(), id, 'edit'))
  WITH CHECK (public.can_access_document(auth.uid(), id, 'edit'));

CREATE POLICY "documents_delete_authorized" ON public.documents
  FOR DELETE TO authenticated
  USING (public.can_access_document(auth.uid(), id, 'delete'));

-- document_role_permissions
CREATE POLICY "doc_perms_select_authenticated" ON public.document_role_permissions
  FOR SELECT TO authenticated
  USING (public.can_access_document(auth.uid(), document_id, 'view'));

CREATE POLICY "doc_perms_manage_editor" ON public.document_role_permissions
  FOR ALL TO authenticated
  USING (public.can_access_document(auth.uid(), document_id, 'edit'))
  WITH CHECK (public.can_access_document(auth.uid(), document_id, 'edit'));

-- document_access_logs
CREATE POLICY "doc_logs_insert_self" ON public.document_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "doc_logs_select_admin_or_owner" ON public.document_access_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_access_logs.document_id AND d.uploaded_by = auth.uid()
    )
  );

-- =========================================================================
-- STORAGE POLICIES (bucket: documents)
-- =========================================================================
CREATE POLICY "storage_documents_select_authorized" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND public.can_access_document(auth.uid(), d.id, 'view')
    )
  );

CREATE POLICY "storage_documents_insert_uploaders" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.can_upload_documents(auth.uid()));

CREATE POLICY "storage_documents_update_authorized" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND public.can_access_document(auth.uid(), d.id, 'edit')
    )
  );

CREATE POLICY "storage_documents_delete_authorized" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND public.can_access_document(auth.uid(), d.id, 'delete')
    )
  );

-- =========================================================================
-- TRIGGERS
-- =========================================================================
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_folders_updated_at
  BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Log automático de criação de documento
CREATE OR REPLACE FUNCTION public.log_document_upload()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.document_access_logs (document_id, user_id, action, details)
  VALUES (NEW.id, NEW.uploaded_by, 'upload',
    jsonb_build_object('filename', NEW.filename, 'size', NEW.size_bytes));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_documents_log_upload
  AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.log_document_upload();

-- =========================================================================
-- SEED — categorias raiz
-- =========================================================================
INSERT INTO public.document_folders (name, category, is_system) VALUES
  ('Documentos',   'documentos',   true),
  ('Formulários',  'formularios',  true),
  ('Atas',         'atas',         true),
  ('Regulamentos', 'regulamentos', true),
  ('Certificados', 'certificados', true),
  ('Apostilas',    'apostilas',    true),
  ('Eventos',      'eventos',      true);

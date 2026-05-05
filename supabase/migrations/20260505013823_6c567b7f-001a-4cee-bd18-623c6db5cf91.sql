
-- Galeria de fotos por integrante (centraliza armazenamento no bucket scout-photos)
CREATE TABLE public.scout_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text NOT NULL DEFAULT '',
  uploaded_by uuid NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'image/jpeg',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scout_photos_scout_id ON public.scout_photos(scout_id, created_at DESC);

ALTER TABLE public.scout_photos ENABLE ROW LEVEL SECURITY;

-- Visualização: admin sempre; voluntário/dirigente/permissão respeitando seção do integrante
CREATE POLICY "Section-based view scout_photos"
ON public.scout_photos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'voluntario'::app_role)
     OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
     OR has_permission(auth.uid(), 'manage_scouts'::text))
    AND EXISTS (
      SELECT 1 FROM public.scouts s
      WHERE s.id = scout_photos.scout_id
        AND (
          get_user_section(auth.uid()) IS NULL
          OR get_user_section(auth.uid()) = ''
          OR s.section = get_user_section(auth.uid())
        )
    )
  )
);

-- Inserção: admin ou voluntário, deve marcar uploaded_by = auth.uid()
CREATE POLICY "Admins voluntarios can insert scout_photos"
ON public.scout_photos
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role))
);

-- Atualização (legenda): autor ou admin
CREATE POLICY "Owners or admins update scout_photos"
ON public.scout_photos
FOR UPDATE
TO authenticated
USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));

-- Exclusão: autor, admin ou voluntário
CREATE POLICY "Owners admins voluntarios delete scout_photos"
ON public.scout_photos
FOR DELETE
TO authenticated
USING (
  auth.uid() = uploaded_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'voluntario'::app_role)
);

-- Políticas de Storage para o subdiretório gallery/ do bucket scout-photos
CREATE POLICY "Auth read scout-photos gallery"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND (storage.foldername(name))[1] = 'gallery'
);

CREATE POLICY "Admins voluntarios upload scout-photos gallery"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scout-photos'
  AND (storage.foldername(name))[1] = 'gallery'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role))
);

CREATE POLICY "Admins voluntarios delete scout-photos gallery"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND (storage.foldername(name))[1] = 'gallery'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role))
);

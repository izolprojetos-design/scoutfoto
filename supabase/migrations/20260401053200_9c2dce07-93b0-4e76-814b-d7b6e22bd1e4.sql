
-- 2. Migrate existing user_roles
UPDATE public.user_roles SET role = 'voluntario' WHERE role IN ('chefe', 'dirigente');

-- 3. Create role_descriptions table for CRUD screen
CREATE TABLE IF NOT EXISTS public.role_descriptions (
  role public.app_role PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT ''
);

ALTER TABLE public.role_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage role_descriptions" ON public.role_descriptions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view role_descriptions" ON public.role_descriptions
  FOR SELECT TO authenticated USING (true);

-- Seed role_descriptions
INSERT INTO public.role_descriptions (role, display_name, description) VALUES
  ('admin', 'Administrador', 'Acesso total ao sistema. Gerencia usuários, permissões e configurações.'),
  ('voluntario', 'Voluntário', 'Voluntário ativo no grupo escoteiro. Pode gerenciar integrantes, eventos e fotos conforme permissões.'),
  ('dirigente_gestor', 'Dirigente Gestor', 'Responsável pela gestão administrativa e organizacional do grupo.'),
  ('parent', 'Pai/Mãe', 'Responsável por um ou mais integrantes. Acesso limitado a informações relevantes.'),
  ('viewer', 'Visitante', 'Acesso de visualização. Não pode editar ou gerenciar dados.')
ON CONFLICT (role) DO NOTHING;

-- 4. Update RLS policies on event_permissions
DROP POLICY IF EXISTS "Admins chefes dirigentes can manage event_permissions" ON public.event_permissions;
CREATE POLICY "Admins voluntarios can manage event_permissions" ON public.event_permissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

-- 5. Update RLS policies on event_share_links
DROP POLICY IF EXISTS "Admins chefes dirigentes can manage share links" ON public.event_share_links;
CREATE POLICY "Admins voluntarios can manage share links" ON public.event_share_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Authenticated managers can view share links" ON public.event_share_links;
CREATE POLICY "Authenticated managers can view share links" ON public.event_share_links
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role) OR (created_by = auth.uid()));

DROP POLICY IF EXISTS "Can insert share links" ON public.event_share_links;
CREATE POLICY "Can insert share links" ON public.event_share_links
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role)));

-- 6. Update RLS policies on events
DROP POLICY IF EXISTS "Admins chefes dirigentes can delete events" ON public.events;
CREATE POLICY "Admins voluntarios can delete events" ON public.events
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Admins chefes dirigentes can manage events" ON public.events;
CREATE POLICY "Admins voluntarios can manage events" ON public.events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Can insert events" ON public.events;
CREATE POLICY "Can insert events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

-- 7. Update RLS policies on guardians
DROP POLICY IF EXISTS "Can insert guardians" ON public.guardians;
CREATE POLICY "Can insert guardians" ON public.guardians
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role)));

DROP POLICY IF EXISTS "Creators can delete own guardians" ON public.guardians;
CREATE POLICY "Creators can delete own guardians" ON public.guardians
  FOR DELETE TO authenticated
  USING ((auth.uid() = created_by) AND (has_role(auth.uid(), 'voluntario'::app_role)));

DROP POLICY IF EXISTS "Creators can update own guardians" ON public.guardians;
CREATE POLICY "Creators can update own guardians" ON public.guardians
  FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by) AND (has_role(auth.uid(), 'voluntario'::app_role)))
  WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'voluntario'::app_role)));

DROP POLICY IF EXISTS "Permission-based view guardians" ON public.guardians;
CREATE POLICY "Permission-based view guardians" ON public.guardians
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role) OR has_role(auth.uid(), 'dirigente_gestor'::app_role) OR has_permission(auth.uid(), 'view_guardians'::text));

-- 8. Update RLS policies on images
DROP POLICY IF EXISTS "Chefes and dirigentes can view all images" ON public.images;
CREATE POLICY "Voluntarios can view all images" ON public.images
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Authenticated can insert images" ON public.images;
CREATE POLICY "Authenticated can insert images" ON public.images
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role)));

DROP POLICY IF EXISTS "Group images visible to role-based users" ON public.images;
CREATE POLICY "Group images visible to role-based users" ON public.images
  FOR SELECT TO authenticated
  USING ((visibility = 'group'::image_visibility) AND (minor_age IS NULL) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role) OR has_role(auth.uid(), 'dirigente_gestor'::app_role) OR has_permission(auth.uid(), 'view_photos'::text)));

-- 9. Update RLS policies on scouts
DROP POLICY IF EXISTS "Admins chefes dirigentes can delete scouts" ON public.scouts;
CREATE POLICY "Admins voluntarios can delete scouts" ON public.scouts
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Admins chefes dirigentes can manage scouts" ON public.scouts;
CREATE POLICY "Admins voluntarios can manage scouts" ON public.scouts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Can insert scouts" ON public.scouts;
CREATE POLICY "Can insert scouts" ON public.scouts
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role)));

DROP POLICY IF EXISTS "Can update scouts" ON public.scouts;
CREATE POLICY "Can update scouts" ON public.scouts
  FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role)))
  WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role)));

DROP POLICY IF EXISTS "Role-based view scouts" ON public.scouts;
CREATE POLICY "Role-based view scouts" ON public.scouts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role) OR has_role(auth.uid(), 'dirigente_gestor'::app_role) OR has_permission(auth.uid(), 'manage_scouts'::text));

-- 10. Update RLS policies on subgroups
DROP POLICY IF EXISTS "Admins chefes dirigentes can delete subgroups" ON public.subgroups;
CREATE POLICY "Admins voluntarios can delete subgroups" ON public.subgroups
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Admins chefes dirigentes can manage subgroups" ON public.subgroups;
CREATE POLICY "Admins voluntarios can manage subgroups" ON public.subgroups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Admins chefes dirigentes can update subgroups" ON public.subgroups;
CREATE POLICY "Admins voluntarios can update subgroups" ON public.subgroups
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role));

DROP POLICY IF EXISTS "Can insert subgroups" ON public.subgroups;
CREATE POLICY "Can insert subgroups" ON public.subgroups
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role)));

-- 11. Update DB function: can_view_storage_image
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.images i
    WHERE i.storage_path = _storage_path
    AND (
      i.user_id = _user_id
      OR has_role(_user_id, 'admin')
      OR has_role(_user_id, 'voluntario')
      OR (
        i.minor_age IS NULL
        AND i.visibility IN ('group', 'public')
        AND has_permission(_user_id, 'view_photos')
      )
    )
  )
$function$;

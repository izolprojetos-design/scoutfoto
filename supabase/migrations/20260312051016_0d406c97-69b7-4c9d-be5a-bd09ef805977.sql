
-- Create permissions table
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(role, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed permissions
INSERT INTO public.permissions (key, name, category, sort_order) VALUES
  ('view_photos', 'Ver fotos', 'Fotos', 1),
  ('upload_photos', 'Enviar fotos', 'Fotos', 2),
  ('download_photos', 'Baixar fotos', 'Fotos', 3),
  ('manage_events', 'Gerenciar eventos', 'Eventos', 4),
  ('manage_scouts', 'Gerenciar integrantes', 'Integrantes', 5),
  ('manage_users', 'Gerenciar usuários', 'Administração', 6);

-- Seed default role_permissions
-- Admin gets everything
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM public.permissions;

-- Chefe gets all except manage_users
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'chefe'::app_role, id FROM public.permissions WHERE key != 'manage_users';

-- Dirigente gets all except manage_users
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'dirigente'::app_role, id FROM public.permissions WHERE key != 'manage_users';

-- Uploader gets view, upload, download photos
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'uploader'::app_role, id FROM public.permissions WHERE key IN ('view_photos', 'upload_photos', 'download_photos');

-- Viewer gets view_photos only
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'viewer'::app_role, id FROM public.permissions WHERE key = 'view_photos';

-- Create function to check permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.key = _permission_key
  )
$$;

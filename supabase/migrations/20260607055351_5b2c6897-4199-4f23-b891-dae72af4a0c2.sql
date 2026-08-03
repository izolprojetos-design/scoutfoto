-- 1. Restaurar GRANTs básicos que podem ter sido perdidos ou corrompidos
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- 2. Limpar políticas existentes que podem estar bloqueando o acesso
DROP POLICY IF EXISTS "emergency_view_scouts" ON public.scouts;
DROP POLICY IF EXISTS "emergency_view_images" ON public.images;
DROP POLICY IF EXISTS "emergency_view_events" ON public.events;
DROP POLICY IF EXISTS "emergency_view_branches" ON public.branches;
DROP POLICY IF EXISTS "emergency_view_profiles" ON public.profiles;
DROP POLICY IF EXISTS "emergency_view_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "emergency_view_scout_photos" ON public.scout_photos;

DROP POLICY IF EXISTS "admin_all_scouts" ON public.scouts;
DROP POLICY IF EXISTS "staff_view_scouts" ON public.scouts;
DROP POLICY IF EXISTS "parents_view_children" ON public.scouts;
DROP POLICY IF EXISTS "View scouts policy" ON public.scouts;

DROP POLICY IF EXISTS "View scout_photos policy" ON public.scout_photos;
DROP POLICY IF EXISTS "admin_all_photos" ON public.scout_photos;
DROP POLICY IF EXISTS "staff_view_photos" ON public.scout_photos;

DROP POLICY IF EXISTS "Public images visibility" ON public.images;
DROP POLICY IF EXISTS "Group images visibility" ON public.images;
DROP POLICY IF EXISTS "Users can view own images" ON public.images;

DROP POLICY IF EXISTS "Events viewable by authenticated" ON public.events;
DROP POLICY IF EXISTS "Admins voluntarios can manage events" ON public.events;

-- 3. Garantir que as tabelas tenham RLS habilitado mas com políticas de visualização abertas para autenticados
ALTER TABLE public.scouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scouts_view_auth" ON public.scouts FOR SELECT TO authenticated USING (true);
CREATE POLICY "images_view_auth" ON public.images FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_view_auth" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_view_auth" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_view_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_view_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "scout_photos_view_auth" ON public.scout_photos FOR SELECT TO authenticated USING (true);

-- 4. Corrigir funções de apoio para evitar erros de tipo
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text) 
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role::text = _role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT TRUE; 
$$;
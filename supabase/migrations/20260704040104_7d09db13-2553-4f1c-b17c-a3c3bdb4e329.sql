CREATE OR REPLACE FUNCTION public.can_view_member_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.is_team_member(_user_id)
      OR public.has_permission(_user_id, 'view_scouts')
      OR public.has_permission(_user_id, 'view_photos')
      OR public.has_permission(_user_id, 'manage_scouts')
      OR public.has_permission(_user_id, 'manage_users')
      OR public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'voluntario'::app_role)
    );
$$;

DROP POLICY IF EXISTS "scouts_view_staff" ON public.scouts;
CREATE POLICY "scouts_view_staff"
  ON public.scouts
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.can_view_member_data(auth.uid()));

DROP POLICY IF EXISTS "profiles_view_authorized_member_data" ON public.profiles;
CREATE POLICY "profiles_view_authorized_member_data"
  ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.can_view_member_data(auth.uid()));

DROP POLICY IF EXISTS "scout_photos_view_authorized_member_data" ON public.scout_photos;
CREATE POLICY "scout_photos_view_authorized_member_data"
  ON public.scout_photos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.can_view_member_data(auth.uid()));

DROP POLICY IF EXISTS "images_view_authorized_member_data" ON public.images;
CREATE POLICY "images_view_authorized_member_data"
  ON public.images
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.can_view_member_data(auth.uid()));

DROP POLICY IF EXISTS "Authorized users can read scout photos" ON storage.objects;
CREATE POLICY "Authorized users can read scout photos"
  ON storage.objects
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'scout-photos'
    AND public.can_view_member_data(auth.uid())
  );
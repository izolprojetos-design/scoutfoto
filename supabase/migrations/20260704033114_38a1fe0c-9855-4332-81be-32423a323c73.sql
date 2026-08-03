-- Helper: user has any assigned role (i.e., is a vetted team member)
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE POLICY "profiles_view_team_members"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "images_view_team_members"
  ON public.images
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "scout_photos_view_team_members"
  ON public.scout_photos
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));
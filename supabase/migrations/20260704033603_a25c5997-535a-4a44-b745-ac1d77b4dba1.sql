DROP POLICY IF EXISTS "scouts_view_team_members" ON public.scouts;

CREATE POLICY "scouts_view_team_members"
  ON public.scouts
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "scouts_view_auth" ON public.scouts;

CREATE POLICY "scouts_view_admin"
  ON public.scouts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "scouts_view_staff"
  ON public.scouts
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'manage_scouts')
    OR public.has_permission(auth.uid(), 'view_photos')
  );

CREATE POLICY "scouts_view_owner"
  ON public.scouts
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "scouts_view_same_section"
  ON public.scouts
  FOR SELECT
  TO authenticated
  USING (
    section IS NOT NULL
    AND section = public.get_user_section(auth.uid())
  );

CREATE POLICY "scouts_view_guardian"
  ON public.scouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.scout_id = scouts.id
        AND g.created_by = auth.uid()
    )
  );
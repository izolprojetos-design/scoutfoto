-- events: remove universal read; add scoped SELECT policies
DROP POLICY IF EXISTS "events_view_auth" ON public.events;

CREATE POLICY "events_view_admin"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "events_view_staff"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'view_photos'));

CREATE POLICY "events_view_creator"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "events_view_permission"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (public.has_event_permission(auth.uid(), id, 'view'));

-- user_roles: remove universal read policy
DROP POLICY IF EXISTS "user_roles_view_auth" ON public.user_roles;

-- Pin search_path on has_role(text) overload
ALTER FUNCTION public.has_role(uuid, text) SET search_path = public;
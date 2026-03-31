
-- Allow users with manage_events or manage_users permission to view profiles
-- This is needed for EventPermissionsDialog and ActivityLogsViewer
CREATE POLICY "Users with manage permissions can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_permission(auth.uid(), 'manage_events') OR
  has_permission(auth.uid(), 'manage_users')
);

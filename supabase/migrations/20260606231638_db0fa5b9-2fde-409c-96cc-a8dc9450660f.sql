
-- 1. Fix can_view_storage_image: add minor_age IS NULL on view_photos branch
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

-- 2. Restrict global_settings SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can read global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Public can read global settings" ON public.global_settings;
DROP POLICY IF EXISTS "global_settings_select" ON public.global_settings;
DROP POLICY IF EXISTS "Everyone can read global settings" ON public.global_settings;

CREATE POLICY "Authenticated users can read global settings"
  ON public.global_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Fix Group images visibility policy on images to exclude minors on view_photos branch
DROP POLICY IF EXISTS "Group images visibility" ON public.images;

CREATE POLICY "Group images visibility"
  ON public.images
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'group'
    AND minor_age IS NULL
    AND has_permission(auth.uid(), 'view_photos')
  );

-- 4. Allow service_role to write login_attempts
CREATE POLICY "Service role can manage login_attempts"
  ON public.login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Allow admins to read suppressed_emails for oversight
CREATE POLICY "Admins can read suppressed emails"
  ON public.suppressed_emails
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

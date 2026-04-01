
-- FIX 1: Remove OR NOT EXISTS fallback from storage image check
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.images i
    WHERE i.storage_path = _storage_path
    AND (
      i.user_id = _user_id
      OR has_role(_user_id, 'admin')
      OR has_role(_user_id, 'chefe')
      OR has_role(_user_id, 'dirigente')
      OR (
        i.minor_age IS NULL
        AND i.visibility IN ('group', 'public')
        AND has_permission(_user_id, 'view_photos')
      )
    )
  )
$$;

-- FIX 2: Restrict security_notifications INSERT to service_role only
DROP POLICY IF EXISTS "Authenticated can insert own notifications" ON public.security_notifications;

-- FIX 3: Restrict audit_logs INSERT to service_role
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;

CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role'::text);

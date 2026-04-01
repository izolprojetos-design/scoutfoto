
-- Restore audit_logs INSERT for authenticated users (scoped to own user_id)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Restore security_notifications INSERT for authenticated users (scoped to own user_id)
CREATE POLICY "Authenticated can insert own notifications"
  ON public.security_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

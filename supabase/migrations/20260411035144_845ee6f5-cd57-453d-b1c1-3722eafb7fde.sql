
-- Create a security definer function to insert audit logs securely
CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _image_id uuid DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb,
  _before_data jsonb DEFAULT NULL,
  _after_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, image_id, details, before_data, after_data)
  VALUES (auth.uid(), _action, _image_id, _details, _before_data, _after_data);
END;
$$;

-- Drop the old permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;

-- Add a restrictive INSERT policy: only service_role can insert directly
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- Defense-in-depth: RESTRICTIVE policy ensures ONLY admins or service_role can write to user_roles,
-- regardless of any permissive policies that may exist now or be added later.

CREATE POLICY "Restrict user_roles writes to admins or service role"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.role() = 'service_role'
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.role() = 'service_role'
);
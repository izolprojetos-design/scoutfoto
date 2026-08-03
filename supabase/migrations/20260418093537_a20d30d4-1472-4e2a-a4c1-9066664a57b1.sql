-- Remove the restrictive policy that was blocking SELECT of own role for non-admins.
-- The "Restrict user_roles writes to admins or service role" policy was PERMISSIVE: No (RESTRICTIVE)
-- with command ALL, which combined with AND across all operations including SELECT, blocking
-- non-admin users from reading their own role.
DROP POLICY IF EXISTS "Restrict user_roles writes to admins or service role" ON public.user_roles;

-- Re-add the write restriction, but scoped only to write operations (INSERT/UPDATE/DELETE),
-- so it does NOT interfere with SELECT.
CREATE POLICY "Restrict user_roles inserts to admins or service role"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.role() = 'service_role'
);

CREATE POLICY "Restrict user_roles updates to admins or service role"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.role() = 'service_role'
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.role() = 'service_role'
);

CREATE POLICY "Restrict user_roles deletes to admins or service role"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.role() = 'service_role'
);
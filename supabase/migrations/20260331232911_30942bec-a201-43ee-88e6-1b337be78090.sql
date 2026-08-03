
-- 1. USER_ROLES: Fix privilege escalation - use RESTRICTIVE policy
DROP POLICY IF EXISTS "Non-admins cannot insert roles" ON public.user_roles;

-- The admin ALL policy already covers INSERT for admins.
-- We don't need an additional permissive INSERT policy.
-- RLS with no permissive INSERT policy for non-admins = deny by default. Safe.

-- 2. GROUP IMAGES: Restrict to appropriate roles
DROP POLICY IF EXISTS "Group images visible to authenticated" ON public.images;

CREATE POLICY "Group images visible to role-based users"
ON public.images FOR SELECT
TO authenticated
USING (
  visibility = 'group'::image_visibility AND
  minor_age IS NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'chefe'::app_role) OR
    has_role(auth.uid(), 'dirigente'::app_role) OR
    has_role(auth.uid(), 'dirigente_gestor'::app_role) OR
    has_permission(auth.uid(), 'view_photos')
  )
);

-- 3. GUARDIANS: Tighten UPDATE/DELETE with ownership or admin check
DROP POLICY IF EXISTS "Admins chefes dirigentes can manage guardians" ON public.guardians;
DROP POLICY IF EXISTS "Admins chefes dirigentes can delete guardians" ON public.guardians;

CREATE POLICY "Admins can manage all guardians"
ON public.guardians FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators can update own guardians"
ON public.guardians FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by AND (
    has_role(auth.uid(), 'chefe'::app_role) OR
    has_role(auth.uid(), 'dirigente'::app_role)
  )
)
WITH CHECK (
  auth.uid() = created_by AND (
    has_role(auth.uid(), 'chefe'::app_role) OR
    has_role(auth.uid(), 'dirigente'::app_role)
  )
);

CREATE POLICY "Creators can delete own guardians"
ON public.guardians FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by AND (
    has_role(auth.uid(), 'chefe'::app_role) OR
    has_role(auth.uid(), 'dirigente'::app_role)
  )
);

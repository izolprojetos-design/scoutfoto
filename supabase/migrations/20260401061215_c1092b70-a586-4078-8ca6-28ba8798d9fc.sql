
-- Function to get the section of a user from their profile
CREATE OR REPLACE FUNCTION public.get_user_section(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT section FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Drop existing restrictive SELECT policies on scouts that we'll replace
DROP POLICY IF EXISTS "Role-based view scouts" ON public.scouts;

-- New policy: section-based access for scouts
-- Admin/voluntario see all OR users with manage_scouts permission see only their section
CREATE POLICY "Section-based view scouts"
ON public.scouts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'voluntario'::app_role)
    AND (
      get_user_section(auth.uid()) IS NULL
      OR get_user_section(auth.uid()) = ''
      OR section = get_user_section(auth.uid())
    )
  )
  OR (
    has_role(auth.uid(), 'dirigente_gestor'::app_role)
    AND (
      get_user_section(auth.uid()) IS NULL
      OR get_user_section(auth.uid()) = ''
      OR section = get_user_section(auth.uid())
    )
  )
  OR (
    has_permission(auth.uid(), 'manage_scouts')
    AND (
      get_user_section(auth.uid()) IS NULL
      OR get_user_section(auth.uid()) = ''
      OR section = get_user_section(auth.uid())
    )
  )
);

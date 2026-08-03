CREATE OR REPLACE FUNCTION public.is_guardian_for_scout(_user_id uuid, _scout_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.guardians g
    WHERE g.scout_id = _scout_id
      AND g.created_by = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_guardian_for_scout(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_guardian_for_scout(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_guardian_for_scout(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS scouts_view_guardian ON public.scouts;
CREATE POLICY scouts_view_guardian
ON public.scouts
FOR SELECT
TO authenticated
USING (public.is_guardian_for_scout(auth.uid(), id));
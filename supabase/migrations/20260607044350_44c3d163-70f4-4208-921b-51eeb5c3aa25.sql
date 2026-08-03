
-- 1) Restrict "Public images visibility" to authenticated users only.
DROP POLICY IF EXISTS "Public images visibility" ON public.images;
CREATE POLICY "Public images visibility"
ON public.images
FOR SELECT
TO authenticated
USING (visibility = 'public'::image_visibility AND minor_age IS NULL);

-- 2) Scope 'parent' role: remove from broad scout select, add narrow policy
DROP POLICY IF EXISTS "View scouts policy" ON public.scouts;
CREATE POLICY "View scouts policy"
ON public.scouts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'voluntario'::app_role)
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  OR has_permission(auth.uid(), 'view_scouts'::text)
);

CREATE POLICY "Parents can view their own children"
ON public.scouts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.scout_id = scouts.id
      AND g.created_by = auth.uid()
  )
);

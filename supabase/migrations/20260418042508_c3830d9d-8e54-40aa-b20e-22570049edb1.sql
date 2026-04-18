-- Replace the overly broad SELECT policy on guardians with section-scoped access,
-- mirroring the section-based logic used in the scouts SELECT policy.

DROP POLICY IF EXISTS "Permission-based view guardians" ON public.guardians;

CREATE POLICY "Section-based view guardians"
ON public.guardians
FOR SELECT
TO authenticated
USING (
  -- Admins always see everything
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'voluntario'::app_role)
      OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
      OR has_permission(auth.uid(), 'view_guardians'::text)
    )
    AND EXISTS (
      SELECT 1 FROM public.scouts s
      WHERE s.id = guardians.scout_id
        AND (
          get_user_section(auth.uid()) IS NULL
          OR get_user_section(auth.uid()) = ''
          OR s.section = get_user_section(auth.uid())
        )
    )
  )
);
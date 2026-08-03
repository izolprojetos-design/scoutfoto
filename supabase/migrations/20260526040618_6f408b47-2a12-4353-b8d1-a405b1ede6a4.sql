
-- Fix: guardians INSERT must enforce section isolation
DROP POLICY IF EXISTS "Can insert guardians" ON public.guardians;
CREATE POLICY "Can insert guardians"
ON public.guardians
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'voluntario'::app_role)
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
  )
);

-- Fix: scout_achievements DELETE must enforce section isolation for voluntarios
DROP POLICY IF EXISTS "Owners admins voluntarios delete scout_achievements" ON public.scout_achievements;
CREATE POLICY "Owners admins voluntarios delete scout_achievements"
ON public.scout_achievements
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = created_by
  OR (
    has_role(auth.uid(), 'voluntario'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.scouts s
      WHERE s.id = scout_achievements.scout_id
        AND (
          get_user_section(auth.uid()) IS NULL
          OR get_user_section(auth.uid()) = ''
          OR s.section = get_user_section(auth.uid())
        )
    )
  )
);

-- Fix: scout_photos DELETE must enforce section isolation for voluntarios
DROP POLICY IF EXISTS "Owners admins voluntarios delete scout_photos" ON public.scout_photos;
CREATE POLICY "Owners admins voluntarios delete scout_photos"
ON public.scout_photos
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = uploaded_by
  OR (
    has_role(auth.uid(), 'voluntario'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.scouts s
      WHERE s.id = scout_photos.scout_id
        AND (
          get_user_section(auth.uid()) IS NULL
          OR get_user_section(auth.uid()) = ''
          OR s.section = get_user_section(auth.uid())
        )
    )
  )
);

-- Fix: scouts UPDATE/DELETE must enforce section isolation for voluntarios.
-- The broad "manage" ALL policy is replaced by an admin-only ALL and scoped UPDATE/DELETE.
DROP POLICY IF EXISTS "Admins voluntarios can manage scouts" ON public.scouts;
DROP POLICY IF EXISTS "Admins voluntarios can update scouts" ON public.scouts;
DROP POLICY IF EXISTS "Admins voluntarios can delete scouts" ON public.scouts;

CREATE POLICY "Admins can manage scouts"
ON public.scouts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Voluntarios can update scouts in section"
ON public.scouts
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'voluntario'::app_role)
  AND (
    get_user_section(auth.uid()) IS NULL
    OR get_user_section(auth.uid()) = ''
    OR section = get_user_section(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'voluntario'::app_role)
  AND (
    get_user_section(auth.uid()) IS NULL
    OR get_user_section(auth.uid()) = ''
    OR section = get_user_section(auth.uid())
  )
);

CREATE POLICY "Voluntarios can delete scouts in section"
ON public.scouts
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'voluntario'::app_role)
  AND (
    get_user_section(auth.uid()) IS NULL
    OR get_user_section(auth.uid()) = ''
    OR section = get_user_section(auth.uid())
  )
);

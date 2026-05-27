
-- 1. Drop broad scout-photos storage policies
DROP POLICY IF EXISTS "Role-based view scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized can upload scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized can update scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized can delete scout photos" ON storage.objects;

-- Add section-scoped UPDATE policy for gallery path (INSERT and DELETE already exist)
CREATE POLICY "Admins voluntarios update scout-photos gallery"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND (storage.foldername(name))[1] = 'gallery'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role))
)
WITH CHECK (
  bucket_id = 'scout-photos'
  AND (storage.foldername(name))[1] = 'gallery'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role))
);

-- 2. email_logs: add service-role-only INSERT policy
CREATE POLICY "Service role can insert email logs"
ON public.email_logs FOR INSERT TO public
WITH CHECK (auth.role() = 'service_role');

-- 3. guardians: replace UPDATE/DELETE policies with section-scoped versions
DROP POLICY IF EXISTS "Creators can update own guardians" ON public.guardians;
DROP POLICY IF EXISTS "Creators can delete own guardians" ON public.guardians;

CREATE POLICY "Creators can update own guardians"
ON public.guardians FOR UPDATE TO authenticated
USING (
  (auth.uid() = created_by)
  AND has_role(auth.uid(), 'voluntario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.scouts s
    WHERE s.id = guardians.scout_id
      AND (get_user_section(auth.uid()) IS NULL
           OR get_user_section(auth.uid()) = ''
           OR s.section = get_user_section(auth.uid()))
  )
)
WITH CHECK (
  (auth.uid() = created_by)
  AND has_role(auth.uid(), 'voluntario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.scouts s
    WHERE s.id = guardians.scout_id
      AND (get_user_section(auth.uid()) IS NULL
           OR get_user_section(auth.uid()) = ''
           OR s.section = get_user_section(auth.uid()))
  )
);

CREATE POLICY "Creators can delete own guardians"
ON public.guardians FOR DELETE TO authenticated
USING (
  (auth.uid() = created_by)
  AND has_role(auth.uid(), 'voluntario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.scouts s
    WHERE s.id = guardians.scout_id
      AND (get_user_section(auth.uid()) IS NULL
           OR get_user_section(auth.uid()) = ''
           OR s.section = get_user_section(auth.uid()))
  )
);

-- 4. scout_achievements: tighten INSERT policy with section scoping
DROP POLICY IF EXISTS "Admins voluntarios can insert scout_achievements" ON public.scout_achievements;

CREATE POLICY "Admins voluntarios can insert scout_achievements"
ON public.scout_achievements FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = created_by)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'voluntario'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.scouts s
        WHERE s.id = scout_achievements.scout_id
          AND (get_user_section(auth.uid()) IS NULL
               OR get_user_section(auth.uid()) = ''
               OR s.section = get_user_section(auth.uid()))
      )
    )
  )
);

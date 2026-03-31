
-- Make scout-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'scout-photos';

-- Drop existing public policy if any
DROP POLICY IF EXISTS "Public read access for scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view scout photos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_scout_photos" ON storage.objects;

-- Authenticated users can read scout-photos
CREATE POLICY "Authenticated can view scout photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'scout-photos');

-- Admins, chefes, dirigentes can upload to scout-photos
CREATE POLICY "Authorized can upload scout photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scout-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'chefe'::public.app_role)
    OR public.has_role(auth.uid(), 'dirigente'::public.app_role)
  )
);

-- Admins, chefes, dirigentes can update scout-photos
CREATE POLICY "Authorized can update scout photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'chefe'::public.app_role)
    OR public.has_role(auth.uid(), 'dirigente'::public.app_role)
  )
);

-- Admins, chefes, dirigentes can delete scout-photos
CREATE POLICY "Authorized can delete scout photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'chefe'::public.app_role)
    OR public.has_role(auth.uid(), 'dirigente'::public.app_role)
  )
);

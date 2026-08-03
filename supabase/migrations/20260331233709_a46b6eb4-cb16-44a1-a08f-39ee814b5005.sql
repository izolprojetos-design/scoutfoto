
-- Fix storage policies: remove overly permissive anon/public access

-- 1. Drop the anon storage policy for images bucket
DROP POLICY IF EXISTS "Anon can view shared event images" ON storage.objects;

-- 2. Drop the public read policy for scout-photos bucket  
DROP POLICY IF EXISTS "Public read access for scout photos" ON storage.objects;

-- 3. Ensure authenticated users with proper roles can read from images bucket
DROP POLICY IF EXISTS "Authenticated can view images" ON storage.objects;
CREATE POLICY "Authenticated can view images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'images');

-- 4. Ensure only leadership roles can read scout-photos
DROP POLICY IF EXISTS "Authenticated leadership can view scout photos" ON storage.objects;
CREATE POLICY "Authenticated leadership can view scout photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'scout-photos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'chefe'::public.app_role)
      OR public.has_role(auth.uid(), 'dirigente'::public.app_role)
      OR public.has_role(auth.uid(), 'dirigente_gestor'::public.app_role)
    )
  );

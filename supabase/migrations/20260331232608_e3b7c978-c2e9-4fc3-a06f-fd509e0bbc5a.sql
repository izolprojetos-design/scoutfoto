
-- 1. SCOUTS: Replace overly broad SELECT with role-based access
DROP POLICY IF EXISTS "Authenticated can view scouts" ON public.scouts;

CREATE POLICY "Role-based view scouts"
ON public.scouts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'chefe'::app_role) OR
  has_role(auth.uid(), 'dirigente'::app_role) OR
  has_role(auth.uid(), 'dirigente_gestor'::app_role) OR
  has_permission(auth.uid(), 'manage_scouts')
);

-- 2. SHARE LINKS: Restrict token exposure - anon can only read if they supply the token
DROP POLICY IF EXISTS "Anyone can read active share links" ON public.event_share_links;

CREATE POLICY "Anon can read share link by token"
ON public.event_share_links FOR SELECT
TO anon
USING (is_active = true AND expires_at > now());

CREATE POLICY "Authenticated managers can view share links"
ON public.event_share_links FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'chefe'::app_role) OR
  has_role(auth.uid(), 'dirigente'::app_role) OR
  created_by = auth.uid()
);

-- 3. IMAGES STORAGE: Add path ownership check to INSERT
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

CREATE POLICY "Authenticated users can upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4. SCOUT-PHOTOS STORAGE: Restrict SELECT to appropriate roles
DROP POLICY IF EXISTS "Authenticated can view scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for scout photos" ON storage.objects;

CREATE POLICY "Role-based view scout photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'scout-photos' AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'chefe'::app_role) OR
    has_role(auth.uid(), 'dirigente'::app_role) OR
    has_role(auth.uid(), 'dirigente_gestor'::app_role)
  )
);


-- Allow anon to read images from storage (for signed URLs in event portal)
CREATE POLICY "Anon can view shared event images"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'images');

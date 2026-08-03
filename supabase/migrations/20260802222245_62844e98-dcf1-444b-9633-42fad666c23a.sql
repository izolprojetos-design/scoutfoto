DROP POLICY IF EXISTS "Users can view all avatares" ON storage.objects;

CREATE POLICY "Authorized users can view avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (
    (storage.foldername(name))[2] = (auth.uid())::text
    OR public.can_view_member_data(auth.uid())
  )
);
-- Restrict DELETE on storage.objects (bucket 'images') to ownership or admin
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;

CREATE POLICY "Users can delete own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'images'
  AND (
    -- Admins can always delete
    has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Owners (record in images table) with delete permission can delete their own files
    (
      EXISTS (
        SELECT 1 FROM public.images i
        WHERE i.storage_path = storage.objects.name
          AND i.user_id = auth.uid()
      )
      AND (
        has_permission(auth.uid(), 'delete_photos'::text)
        OR has_permission(auth.uid(), 'delete_event_photos'::text)
      )
    )
  )
);
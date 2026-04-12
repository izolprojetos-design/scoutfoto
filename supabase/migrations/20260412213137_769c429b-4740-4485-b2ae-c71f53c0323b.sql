-- Drop the restrictive upload policy
DROP POLICY IF EXISTS "Authenticated users can upload own images" ON storage.objects;

-- Create a new policy that allows authenticated users with upload permission to upload to the images bucket
CREATE POLICY "Authenticated users can upload to images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'upload_photos')
    OR has_permission(auth.uid(), 'upload_event_photos')
  )
);

-- Also update the delete policy to not require folder matching
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;

CREATE POLICY "Users can delete own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'delete_photos')
    OR has_permission(auth.uid(), 'delete_event_photos')
  )
);

-- Update the update policy similarly
DROP POLICY IF EXISTS "Authenticated users can update own images" ON storage.objects;

CREATE POLICY "Authenticated users can update own images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'upload_photos')
    OR has_permission(auth.uid(), 'upload_event_photos')
  )
);
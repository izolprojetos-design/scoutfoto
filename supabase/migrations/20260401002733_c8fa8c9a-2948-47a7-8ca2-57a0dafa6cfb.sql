
-- Create a security definer function to check image access at storage level
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.images i
    WHERE i.storage_path = _storage_path
    AND (
      -- Owner can always view
      i.user_id = _user_id
      -- Admin/chefe/dirigente can view all
      OR has_role(_user_id, 'admin')
      OR has_role(_user_id, 'chefe')
      OR has_role(_user_id, 'dirigente')
      -- Others can only view non-minor, non-private images if they have permission
      OR (
        i.minor_age IS NULL
        AND i.visibility IN ('group', 'public')
        AND has_permission(_user_id, 'view_photos')
      )
    )
  )
  -- Also allow if the path doesn't match any image record (e.g. thumbnails, user folders)
  OR NOT EXISTS (
    SELECT 1 FROM public.images WHERE storage_path = _storage_path
  )
$$;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Permission-based view images" ON storage.objects;

-- Replace with a secure policy using the function
CREATE POLICY "Secure view images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'images'
  AND public.can_view_storage_image(auth.uid(), name)
);

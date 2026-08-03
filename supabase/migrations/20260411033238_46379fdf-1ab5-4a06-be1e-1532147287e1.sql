-- Fix 1: Replace broad storage SELECT policy with can_view_storage_image check
DROP POLICY IF EXISTS "Authenticated users can view own or role-based images" ON storage.objects;
DROP POLICY IF EXISTS "Permission-based view images" ON storage.objects;

CREATE POLICY "Authenticated users can view authorized images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'images' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR can_view_storage_image(auth.uid(), name)
  )
);

-- Fix 2: Add WITH CHECK to admin ALL policy on user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
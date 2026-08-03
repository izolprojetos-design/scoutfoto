-- 1. Public images policy: exclude minor photos
DROP POLICY IF EXISTS "Public images visibility" ON public.images;
CREATE POLICY "Public images visibility"
ON public.images
FOR SELECT
USING (visibility = 'public'::image_visibility AND minor_age IS NULL);

-- 2. Update can_view_storage_image to exclude minor photos on permission branch
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.images i
    WHERE i.storage_path = _storage_path
    AND (
      i.user_id = _user_id
      OR has_role(_user_id, 'admin')
      OR has_role(_user_id, 'voluntario')
      OR (
        i.minor_age IS NULL
        AND i.visibility IN ('group', 'public')
        AND has_permission(_user_id, 'view_photos')
      )
    )
  )
$function$;
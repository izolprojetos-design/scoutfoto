CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.images i
        WHERE i.storage_path = _storage_path
          AND (
            i.user_id = _user_id
            OR (i.event_id IS NOT NULL AND public.has_event_permission(_user_id, i.event_id, 'view'))
            OR public.has_permission(_user_id, 'view_photos')
          )
      )
    );
$function$;
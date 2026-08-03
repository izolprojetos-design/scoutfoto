CREATE OR REPLACE FUNCTION public.validate_scout_photo_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    path_parts text[];
    filename text;
BEGIN
    IF NEW.storage_path IS NULL OR btrim(NEW.storage_path) = '' THEN
        RETURN NEW;
    END IF;

    path_parts := string_to_array(NEW.storage_path, '/');
    filename := path_parts[array_length(path_parts, 1)];

    -- Gallery uploads are stored as gallery/<scout_id>/<year>/<date>/<NAME>_<YYYY-MM-DD>_...
    -- Accepts multi-word names and both current and legacy filename formats.
    IF NEW.storage_path LIKE 'gallery/%' THEN
        IF filename !~* '^.+_\d{4}-\d{2}-\d{2}(_.*)?\.(jpg|jpeg|png|webp)$' THEN
            RAISE EXCEPTION 'Formato de arquivo inválido. O nome deve conter o nome do integrante e a data (ex: JOAO_SILVA_2024-01-01_...). Atual: %', filename;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Admins voluntarios read scout-photos member profiles" ON storage.objects;
DROP POLICY IF EXISTS "Admins voluntarios upload scout-photos member profiles" ON storage.objects;
DROP POLICY IF EXISTS "Admins voluntarios update scout-photos member profiles" ON storage.objects;
DROP POLICY IF EXISTS "Admins voluntarios delete scout-photos member profiles" ON storage.objects;

CREATE POLICY "Admins voluntarios read scout-photos member profiles"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND position('/' in name) = 0
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'voluntario'::public.app_role)
    OR public.has_permission(auth.uid(), 'view_scouts')
  )
);

CREATE POLICY "Admins voluntarios upload scout-photos member profiles"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scout-photos'
  AND position('/' in name) = 0
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'voluntario'::public.app_role)
    OR public.has_permission(auth.uid(), 'manage_scouts')
  )
);

CREATE POLICY "Admins voluntarios update scout-photos member profiles"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND position('/' in name) = 0
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'voluntario'::public.app_role)
    OR public.has_permission(auth.uid(), 'manage_scouts')
  )
)
WITH CHECK (
  bucket_id = 'scout-photos'
  AND position('/' in name) = 0
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'voluntario'::public.app_role)
    OR public.has_permission(auth.uid(), 'manage_scouts')
  )
);

CREATE POLICY "Admins voluntarios delete scout-photos member profiles"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND position('/' in name) = 0
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'voluntario'::public.app_role)
    OR public.has_permission(auth.uid(), 'manage_scouts')
  )
);
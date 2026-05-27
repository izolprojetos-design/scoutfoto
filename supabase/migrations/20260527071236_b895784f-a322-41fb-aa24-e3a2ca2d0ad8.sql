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
    path_parts := string_to_array(NEW.storage_path, '/');
    filename := path_parts[array_length(path_parts, 1)];

    -- Accept multi-word names: NAME (with underscores) _ ID _ YYYY-MM-DD _ rest
    IF filename !~ '^.+_[A-Za-z0-9]+_\d{4}-\d{2}-\d{2}(_.*)?$' THEN
        RAISE EXCEPTION 'Formato de arquivo inválido. O nome deve seguir o padrão: NOME_IDUNICO_DATA (ex: JOAO_0001_2024-01-01_...). Atual: %', filename;
    END IF;

    RETURN NEW;
END;
$function$;
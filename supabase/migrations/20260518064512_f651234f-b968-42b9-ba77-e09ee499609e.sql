-- Function to validate the storage path format
CREATE OR REPLACE FUNCTION public.validate_scout_photo_path()
RETURNS TRIGGER AS $$
DECLARE
    path_parts text[];
    filename text;
    scout_name text;
    scout_reg_id text;
    photo_date text;
BEGIN
    -- Get filename from storage_path (everything after the last slash)
    path_parts := string_to_array(NEW.storage_path, '/');
    filename := path_parts[array_length(path_parts, 1)];

    -- Pattern expected: NAME_REGID_YYYY-MM-DD_...
    -- Regex: ^[^_]+_[^_]+_\d{4}-\d{2}-\d{2}_.*
    IF filename !~ '^[^_]+_[^_]+_\d{4}-\d{2}-\d{2}_.*' THEN
        RAISE EXCEPTION 'Formato de arquivo inválido. O nome deve seguir o padrão: NOME_IDUNICO_DATA (ex: JOAO_0001_2024-01-01_...). Atual: %', filename;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for scout_photos table
DROP TRIGGER IF EXISTS trg_validate_scout_photo_path ON public.scout_photos;
CREATE TRIGGER trg_validate_scout_photo_path
BEFORE INSERT OR UPDATE ON public.scout_photos
FOR EACH ROW
EXECUTE FUNCTION public.validate_scout_photo_path();
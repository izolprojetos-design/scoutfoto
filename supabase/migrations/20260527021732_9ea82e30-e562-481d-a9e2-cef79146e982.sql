-- Add foreign key constraint between scout_photos and scouts
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
        WHERE tc.table_name = 'scout_photos' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'scout_id'
    ) THEN
        ALTER TABLE public.scout_photos 
        ADD CONSTRAINT scout_photos_scout_id_fkey 
        FOREIGN KEY (scout_id) 
        REFERENCES public.scouts(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Also add a foreign key for uploaded_by if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
        WHERE tc.table_name = 'scout_photos' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'uploaded_by'
    ) THEN
        ALTER TABLE public.scout_photos 
        ADD CONSTRAINT scout_photos_uploaded_by_fkey 
        FOREIGN KEY (uploaded_by) 
        REFERENCES auth.users(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Add external_url column to images table
ALTER TABLE public.images 
ADD COLUMN external_url TEXT;

-- Make filename and storage_path nullable to support external links
ALTER TABLE public.images 
ALTER COLUMN filename DROP NOT NULL,
ALTER COLUMN storage_path DROP NOT NULL;

-- Update media_type check if any exists (let's assume it's just a text column based on schema info)
-- If there was a constraint, we'd update it here.

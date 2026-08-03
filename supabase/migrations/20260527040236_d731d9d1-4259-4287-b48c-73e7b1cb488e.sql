-- Add cargo_1 and cargo_2 columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cargo_1 TEXT,
ADD COLUMN IF NOT EXISTS cargo_2 TEXT;

-- Update RLS if necessary (usually public.profiles is already covered by existing policies)
-- No changes needed to RLS as existing policies cover all columns.

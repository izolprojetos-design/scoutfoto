
ALTER TABLE public.scouts
  ADD COLUMN IF NOT EXISTS registration_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS section text DEFAULT '';

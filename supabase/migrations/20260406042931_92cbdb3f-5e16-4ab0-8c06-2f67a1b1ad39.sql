
-- Remove the column and retry (it was partially created)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS user_number;
DROP SEQUENCE IF EXISTS public.user_number_seq;

-- Create sequence
CREATE SEQUENCE public.user_number_seq START WITH 1 INCREMENT BY 1;

-- Add column WITHOUT default first
ALTER TABLE public.profiles ADD COLUMN user_number INTEGER UNIQUE;

-- Backfill existing users ordered by creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.profiles
)
UPDATE public.profiles
SET user_number = numbered.rn
FROM numbered
WHERE public.profiles.id = numbered.id;

-- Set sequence to continue after last number
SELECT setval('public.user_number_seq', COALESCE((SELECT MAX(user_number) FROM public.profiles), 0) + 1, false);

-- Now set the default for future inserts
ALTER TABLE public.profiles ALTER COLUMN user_number SET DEFAULT nextval('public.user_number_seq');

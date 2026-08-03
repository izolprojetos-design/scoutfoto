
-- Delete test users from all related tables
DELETE FROM public.user_permissions WHERE user_id IN ('3a8168b0-1f1f-4094-bb7a-611591b0780a', '35ef0d3f-4071-4412-abb6-194708907a7c');
DELETE FROM public.user_roles WHERE user_id IN ('3a8168b0-1f1f-4094-bb7a-611591b0780a', '35ef0d3f-4071-4412-abb6-194708907a7c');
DELETE FROM public.user_devices WHERE user_id IN ('3a8168b0-1f1f-4094-bb7a-611591b0780a', '35ef0d3f-4071-4412-abb6-194708907a7c');
DELETE FROM public.profiles WHERE user_id IN ('3a8168b0-1f1f-4094-bb7a-611591b0780a', '35ef0d3f-4071-4412-abb6-194708907a7c');
DELETE FROM auth.users WHERE id IN ('3a8168b0-1f1f-4094-bb7a-611591b0780a', '35ef0d3f-4071-4412-abb6-194708907a7c');

-- Reset user_number sequence and re-number remaining users
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.profiles
)
UPDATE public.profiles
SET user_number = numbered.rn
FROM numbered
WHERE public.profiles.id = numbered.id;

SELECT setval('public.user_number_seq', COALESCE((SELECT MAX(user_number) FROM public.profiles), 0) + 1, false);

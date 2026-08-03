
-- 1. Add 'voluntario' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'voluntario';

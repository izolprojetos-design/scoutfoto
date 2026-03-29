
-- Migrate existing scouts with dirigente/chefes manual_branch to voluntario
UPDATE public.scouts SET manual_branch = 'voluntario' WHERE manual_branch IN ('dirigente', 'chefes');

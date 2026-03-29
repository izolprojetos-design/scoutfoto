
-- Remove "Dirigente" and "Chefes" branches, add "Voluntário"
DELETE FROM public.branches WHERE key IN ('dirigente', 'chefes');
INSERT INTO public.branches (key, display_name, icon, sort_order)
VALUES ('voluntario', 'Voluntário', '🤝', 5)
ON CONFLICT (key) DO NOTHING;

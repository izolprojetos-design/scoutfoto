INSERT INTO public.permissions (key, name, category, sort_order)
VALUES ('transfer_branch', 'Transferir ramo de integrante', 'Integrantes', 50)
ON CONFLICT (key) DO NOTHING;
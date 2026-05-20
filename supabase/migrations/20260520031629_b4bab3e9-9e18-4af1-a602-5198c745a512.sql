-- Adiciona a nova permissão para Google Drive
INSERT INTO public.permissions (id, key, name, category, sort_order)
VALUES (gen_random_uuid(), 'google_drive_links', 'Gerenciar links do Google Drive', 'Mídia', 10)
ON CONFLICT (key) DO NOTHING;

-- Garantir que a categoria Mídia apareça no RolePermissionsManager e PermissionsManager
-- (isso acontece automaticamente se houver permissões nela)

-- Criar uma tabela de configurações globais se não existir para o controle mestre
CREATE TABLE IF NOT EXISTS public.global_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na global_settings
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Permissões para global_settings
CREATE POLICY "Qualquer um pode ler as configurações globais"
    ON public.global_settings FOR SELECT USING (true);

CREATE POLICY "Apenas administradores podem alterar configurações globais"
    ON public.global_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- Inserir configuração padrão para Google Drive se não existir
INSERT INTO public.global_settings (key, value)
VALUES ('google_drive_integration', '{"enabled": true, "blocked_domains": ["drive.google.com"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

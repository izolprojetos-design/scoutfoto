-- Criação da tabela para registrar os uploads de fotos para o Google Drive
CREATE TABLE IF NOT EXISTS public.drive_uploads_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ramo TEXT NOT NULL,
    nome TEXT NOT NULL,
    data_evento DATE NOT NULL,
    pasta_drive_id TEXT NOT NULL,
    total_fotos INTEGER NOT NULL DEFAULT 0,
    criado_por UUID REFERENCES auth.users(id),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configuração de RLS (Row Level Security)
ALTER TABLE public.drive_uploads_log ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- 1. Qualquer usuário autenticado pode ver o log de uploads
CREATE POLICY "Usuários autenticados podem ver os logs do drive"
    ON public.drive_uploads_log
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Qualquer usuário autenticado pode registrar um upload
CREATE POLICY "Usuários autenticados podem registrar uploads no drive"
    ON public.drive_uploads_log
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = criado_por);

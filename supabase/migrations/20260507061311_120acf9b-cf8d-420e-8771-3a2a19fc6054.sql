-- Adiciona suporte a Lixeira reutilizando a tabela agendamento_archives
ALTER TABLE public.agendamento_archives
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'archived';

ALTER TABLE public.agendamento_archives
  DROP CONSTRAINT IF EXISTS agendamento_archives_kind_check;
ALTER TABLE public.agendamento_archives
  ADD CONSTRAINT agendamento_archives_kind_check CHECK (kind IN ('archived', 'trashed'));

-- Garante unicidade por (user, agendamento, kind) para permitir um mesmo registro
-- ter um arquivo e uma marcação diferente — mas na prática só uma de cada.
DROP INDEX IF EXISTS agendamento_archives_user_agendamento_idx;
DROP INDEX IF EXISTS agendamento_archives_user_agendamento_kind_idx;
CREATE UNIQUE INDEX agendamento_archives_user_agendamento_kind_idx
  ON public.agendamento_archives (user_id, agendamento_id, kind);
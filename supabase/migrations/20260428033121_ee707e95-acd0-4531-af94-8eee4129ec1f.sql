ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS destinatario_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destinatario_secao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destinatario_cargo_1 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destinatario_cargo_2 text NOT NULL DEFAULT '';
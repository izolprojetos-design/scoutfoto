-- Create agendamentos table (simplified scheduling, no approval flow)
CREATE TABLE public.agendamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome_associado text NOT NULL,
  secao text NOT NULL DEFAULT '',
  dirigente text NOT NULL DEFAULT '',
  cargo_1 text NOT NULL DEFAULT '',
  cargo_2 text NOT NULL DEFAULT '',
  email_de text NOT NULL,
  email_para text NOT NULL DEFAULT '',
  data_secao date NOT NULL,
  horario time NOT NULL,
  local text NOT NULL DEFAULT '',
  ramo_escoteiro text NOT NULL DEFAULT '',
  tipo_atividade text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'confirmado',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_agendamentos_user_id ON public.agendamentos(user_id);
CREATE INDEX idx_agendamentos_data ON public.agendamentos(data_secao);

-- Enable RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins can manage all agendamentos"
  ON public.agendamentos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins/voluntarios can insert their own
CREATE POLICY "Admins voluntarios can create agendamentos"
  ON public.agendamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'voluntario'::app_role))
  );

-- Users can view their own
CREATE POLICY "Users can view own agendamentos"
  ON public.agendamentos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own
CREATE POLICY "Users can update own agendamentos"
  ON public.agendamentos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own
CREATE POLICY "Users can delete own agendamentos"
  ON public.agendamentos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
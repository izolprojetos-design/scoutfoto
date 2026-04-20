-- Tabela de agendamentos de seção
CREATE TABLE public.scheduling_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome_responsavel text NOT NULL,
  email text NOT NULL,
  data date NOT NULL,
  horario text NOT NULL,
  local text NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  tipo text NOT NULL CHECK (tipo IN ('reuniao', 'acampamento', 'atividade_especial', 'outro')),
  descricao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado_email', 'aprovado', 'rejeitado')),
  token_confirmacao text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  rejection_reason text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_scheduling_requests_user_id ON public.scheduling_requests(user_id);
CREATE INDEX idx_scheduling_requests_status ON public.scheduling_requests(status);
CREATE INDEX idx_scheduling_requests_data ON public.scheduling_requests(data);
CREATE INDEX idx_scheduling_requests_token ON public.scheduling_requests(token_confirmacao);

-- Trigger updated_at
CREATE TRIGGER update_scheduling_requests_updated_at
  BEFORE UPDATE ON public.scheduling_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.scheduling_requests ENABLE ROW LEVEL SECURITY;

-- Apenas admins e voluntários podem criar (regra de negócio escolhida)
CREATE POLICY "Admins voluntarios can create scheduling requests"
  ON public.scheduling_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role))
  );

-- Usuários podem ver suas próprias solicitações
CREATE POLICY "Users can view own scheduling requests"
  ON public.scheduling_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins podem ver todas
CREATE POLICY "Admins can view all scheduling requests"
  ON public.scheduling_requests
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem atualizar todas (futuro: aprovar/rejeitar)
CREATE POLICY "Admins can update all scheduling requests"
  ON public.scheduling_requests
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem atualizar suas próprias enquanto pendentes (futuro: edição)
CREATE POLICY "Users can update own pending scheduling requests"
  ON public.scheduling_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status IN ('pendente', 'confirmado_email')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pendente', 'confirmado_email')
  );

-- Usuários podem deletar suas próprias enquanto pendentes
CREATE POLICY "Users can delete own pending scheduling requests"
  ON public.scheduling_requests
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'pendente'
  );
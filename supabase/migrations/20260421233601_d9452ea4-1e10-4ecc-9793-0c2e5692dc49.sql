
-- Create the multi-approval table
CREATE TABLE public.aprovacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID NOT NULL REFERENCES public.scheduling_requests(id) ON DELETE CASCADE,
  nivel INTEGER NOT NULL CHECK (nivel IN (1, 2)),
  aprovado_por UUID,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  motivo_rejeicao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (agendamento_id, nivel)
);

-- Enable RLS
ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all aprovacoes"
ON public.aprovacoes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view aprovacoes for their own scheduling requests
CREATE POLICY "Users can view own request aprovacoes"
ON public.aprovacoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scheduling_requests sr
    WHERE sr.id = aprovacoes.agendamento_id
    AND sr.user_id = auth.uid()
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_aprovacoes_updated_at
BEFORE UPDATE ON public.aprovacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for aprovacoes
ALTER PUBLICATION supabase_realtime ADD TABLE public.aprovacoes;

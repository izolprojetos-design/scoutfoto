-- Permitir que o destinatário (match por email do profile) também veja o agendamento
DROP POLICY IF EXISTS "Users can view own agendamentos" ON public.agendamentos;

CREATE POLICY "Users can view own or recipient agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.email) = lower(public.agendamentos.email_para)
  )
);
-- Permite que voluntários e admins vejam agendamentos criados por outros admins/voluntários
CREATE POLICY "Admins voluntarios can view all agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'voluntario'::app_role)
);
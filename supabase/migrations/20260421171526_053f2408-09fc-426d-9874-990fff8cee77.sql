
-- Rename table
ALTER TABLE public.scheduling_attachments RENAME TO agendamento_anexos;

-- Rename column
ALTER TABLE public.agendamento_anexos RENAME COLUMN scheduling_request_id TO agendamento_id;

-- Drop old RLS policies (they reference old table name internally but Postgres keeps them; recreate for clarity)
DROP POLICY IF EXISTS "Admin can view all attachments" ON public.agendamento_anexos;
DROP POLICY IF EXISTS "Owner can delete own attachments" ON public.agendamento_anexos;
DROP POLICY IF EXISTS "Owner can insert attachments" ON public.agendamento_anexos;
DROP POLICY IF EXISTS "Owner can view own attachments" ON public.agendamento_anexos;

-- Recreate RLS policies with correct references
CREATE POLICY "Admin can view all attachments"
  ON public.agendamento_anexos FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner can view own attachments"
  ON public.agendamento_anexos FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scheduling_requests sr
    WHERE sr.id = agendamento_anexos.agendamento_id AND sr.user_id = auth.uid()
  ));

CREATE POLICY "Owner can insert attachments"
  ON public.agendamento_anexos FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM scheduling_requests sr
    WHERE sr.id = agendamento_anexos.agendamento_id
      AND sr.user_id = auth.uid()
      AND sr.status IN ('pendente','confirmado_email')
  ));

CREATE POLICY "Owner can delete own attachments"
  ON public.agendamento_anexos FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scheduling_requests sr
    WHERE sr.id = agendamento_anexos.agendamento_id
      AND sr.user_id = auth.uid()
      AND sr.status IN ('pendente','confirmado_email')
  ));

-- 1. Add recipient response columns
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS recipient_response text NOT NULL DEFAULT 'pendente'
    CHECK (recipient_response IN ('pendente','confirmado','recusado')),
  ADD COLUMN IF NOT EXISTS recipient_response_reason text,
  ADD COLUMN IF NOT EXISTS recipient_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipient_response_by uuid;

-- 2. RPC for recipient to respond
CREATE OR REPLACE FUNCTION public.respond_agendamento(
  p_agendamento_id uuid,
  p_response text,
  p_reason text DEFAULT NULL
)
RETURNS public.agendamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_rec public.agendamentos;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF p_response NOT IN ('confirmado','recusado') THEN
    RAISE EXCEPTION 'Resposta inválida';
  END IF;

  SELECT email INTO v_user_email FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_user_email IS NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  SELECT * INTO v_rec FROM public.agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF lower(coalesce(v_user_email,'')) <> lower(coalesce(v_rec.email_para,'')) THEN
    RAISE EXCEPTION 'Apenas o destinatário pode responder';
  END IF;

  IF p_response = 'recusado' AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'Motivo da recusa é obrigatório';
  END IF;

  UPDATE public.agendamentos
     SET recipient_response = p_response,
         recipient_response_reason = CASE WHEN p_response = 'recusado' THEN trim(p_reason) ELSE NULL END,
         recipient_response_at = now(),
         recipient_response_by = v_user_id,
         updated_at = now()
   WHERE id = p_agendamento_id
  RETURNING * INTO v_rec;

  RETURN v_rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_agendamento(uuid, text, text) TO authenticated;

-- 3. Trigger: notify requester when recipient responds
CREATE OR REPLACE FUNCTION public.notify_agendamento_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_msg text;
  v_priority text;
  v_recipient_name text;
BEGIN
  IF NEW.recipient_response IS DISTINCT FROM OLD.recipient_response
     AND NEW.recipient_response IN ('confirmado','recusado') THEN

    v_recipient_name := COALESCE(NULLIF(trim(NEW.destinatario_nome),''), NEW.email_para, 'Destinatário');

    IF NEW.recipient_response = 'confirmado' THEN
      v_title := 'Agendamento confirmado';
      v_msg := v_recipient_name || ' confirmou o agendamento "' ||
               COALESCE(NULLIF(trim(NEW.observacoes),''), NEW.tipo_atividade, 'sem assunto') || '".';
      v_priority := 'medium';
    ELSE
      v_title := 'Agendamento recusado';
      v_msg := v_recipient_name || ' recusou o agendamento. Motivo: ' ||
               COALESCE(NEW.recipient_response_reason, '—');
      v_priority := 'high';
    END IF;

    INSERT INTO public.security_notifications (user_id, type, title, message, priority, metadata)
    VALUES (
      NEW.user_id,
      'agendamento_response',
      v_title,
      v_msg,
      v_priority,
      jsonb_build_object(
        'agendamento_id', NEW.id,
        'response', NEW.recipient_response,
        'reason', NEW.recipient_response_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agendamento_response ON public.agendamentos;
CREATE TRIGGER trg_notify_agendamento_response
AFTER UPDATE OF recipient_response ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.notify_agendamento_response();

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos;
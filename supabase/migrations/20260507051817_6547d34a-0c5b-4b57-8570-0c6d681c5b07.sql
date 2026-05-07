-- 1. Lock down respond_agendamento (no PUBLIC/anon execute) + block re-response
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
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'Apenas o destinatário pode responder' USING ERRCODE = '42501';
  END IF;

  IF v_rec.recipient_response IS NOT NULL
     AND v_rec.recipient_response <> 'pendente' THEN
    RAISE EXCEPTION 'Este agendamento já foi % e não pode ser respondido novamente.', v_rec.recipient_response
      USING ERRCODE = '22023';
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
     AND (recipient_response IS NULL OR recipient_response = 'pendente')
  RETURNING * INTO v_rec;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conflito: este agendamento já foi respondido.' USING ERRCODE = '40001';
  END IF;

  RETURN v_rec;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_agendamento(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_agendamento(uuid, text, text) TO authenticated;

-- 2. Trigger function: revoke public execute (only invoked via trigger context)
REVOKE EXECUTE ON FUNCTION public.notify_agendamento_response() FROM PUBLIC, anon;
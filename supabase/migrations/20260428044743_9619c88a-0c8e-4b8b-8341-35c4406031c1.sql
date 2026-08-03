CREATE OR REPLACE FUNCTION public.admin_check_agendamento_visibility(
  p_agendamento_id uuid,
  p_email text
)
RETURNS TABLE(
  persona_user_id uuid,
  persona_email text,
  is_sender boolean,
  is_recipient boolean,
  has_admin_role boolean,
  can_view boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_persona_id uuid;
  v_persona_email text;
  v_rec_user uuid;
  v_rec_email text;
  v_is_sender boolean := false;
  v_is_recipient boolean := false;
  v_has_admin boolean := false;
  v_can boolean := false;
  v_reason text;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email required';
  END IF;

  SELECT a.user_id, lower(a.email_para)
    INTO v_rec_user, v_rec_email
    FROM public.agendamentos a
    WHERE a.id = p_agendamento_id;

  IF v_rec_user IS NULL THEN
    RAISE EXCEPTION 'Agendamento not found';
  END IF;

  SELECT p.user_id, lower(p.email)
    INTO v_persona_id, v_persona_email
    FROM public.profiles p
    WHERE lower(p.email) = v_email
    LIMIT 1;

  IF v_persona_id IS NOT NULL THEN
    v_is_sender := (v_persona_id = v_rec_user);
    v_is_recipient := (v_persona_email = v_rec_email);
    v_has_admin := public.has_role(v_persona_id, 'admin'::app_role);
  END IF;

  v_can := v_is_sender OR v_is_recipient OR v_has_admin;

  v_reason := CASE
    WHEN v_persona_id IS NULL THEN 'Profile não encontrado para este e-mail'
    WHEN v_has_admin THEN 'Acesso por papel admin'
    WHEN v_is_sender THEN 'Acesso como remetente (user_id)'
    WHEN v_is_recipient THEN 'Acesso como destinatário (email_para)'
    ELSE 'Sem vínculo com o registro'
  END;

  RETURN QUERY SELECT v_persona_id, v_persona_email, v_is_sender, v_is_recipient, v_has_admin, v_can, v_reason;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_check_agendamento_visibility(uuid, text) TO authenticated;
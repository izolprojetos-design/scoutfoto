CREATE OR REPLACE FUNCTION public.admin_clear_login_history()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  WITH deleted AS (
    DELETE FROM public.audit_logs
    WHERE action = 'login'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM deleted;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_clear_login_history', jsonb_build_object('deleted_count', v_deleted));

  RETURN v_deleted;
END;
$$;
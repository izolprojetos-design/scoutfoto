CREATE OR REPLACE FUNCTION public.admin_clear_inactive_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  WITH target_sessions AS (
    SELECT id, user_id FROM auth.sessions
    WHERE updated_at < now() - interval '30 minutes'
  ),
  del_tokens AS (
    DELETE FROM auth.refresh_tokens
    WHERE session_id IN (SELECT id FROM target_sessions)
    RETURNING 1
  ),
  del_sessions AS (
    DELETE FROM auth.sessions
    WHERE id IN (SELECT id FROM target_sessions)
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM del_sessions;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_clear_inactive_sessions', jsonb_build_object('deleted_count', v_deleted));

  RETURN v_deleted;
END;
$$;
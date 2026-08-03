CREATE OR REPLACE FUNCTION public.admin_signout_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot sign out yourself via this function';
  END IF;

  -- Revoke all refresh tokens for the user (invalidates their ability to refresh)
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
  -- Delete all active sessions for the user (invalidates current access tokens on next check)
  DELETE FROM auth.sessions WHERE user_id = p_user_id;

  PERFORM public.log_audit('admin_signout_user', NULL, jsonb_build_object('target_user_id', p_user_id));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_signout_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_signout_user(uuid) TO authenticated;
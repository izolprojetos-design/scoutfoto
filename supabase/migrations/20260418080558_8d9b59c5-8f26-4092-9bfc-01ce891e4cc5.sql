DROP FUNCTION IF EXISTS public.admin_signout_user(uuid);

CREATE OR REPLACE FUNCTION public.admin_signout_user(p_user_id uuid, p_admin_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_caller uuid := COALESCE(p_admin_user_id, auth.uid());
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF p_user_id = v_caller THEN
    RAISE EXCEPTION 'Cannot sign out yourself via this function';
  END IF;

  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (v_caller, 'admin_signout_user', jsonb_build_object('target_user_id', p_user_id));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_signout_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_signout_user(uuid, uuid) TO authenticated, service_role;
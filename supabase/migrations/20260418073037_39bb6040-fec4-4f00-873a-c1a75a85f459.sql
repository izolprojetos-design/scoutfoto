-- Table to track login attempts/lockouts per email (server-side)
CREATE TABLE IF NOT EXISTS public.login_attempts (
  email text PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0,
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can directly view/manage; functions below run as SECURITY DEFINER
DROP POLICY IF EXISTS "Admins manage login_attempts" ON public.login_attempts;
CREATE POLICY "Admins manage login_attempts"
ON public.login_attempts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Check if an email is currently blocked
CREATE OR REPLACE FUNCTION public.check_login_block(p_email text)
RETURNS TABLE(locked boolean, remaining_seconds integer, failed_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.login_attempts%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.login_attempts WHERE email = lower(p_email);
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  IF rec.locked_until IS NOT NULL AND rec.locked_until > now() THEN
    RETURN QUERY SELECT true, GREATEST(0, EXTRACT(EPOCH FROM (rec.locked_until - now()))::integer), rec.failed_count;
  ELSE
    RETURN QUERY SELECT false, 0, rec.failed_count;
  END IF;
END;
$$;

-- Record a failed attempt; lock for 15 minutes after 5 failures
CREATE OR REPLACE FUNCTION public.record_login_failure(p_email text)
RETURNS TABLE(locked boolean, attempts_left integer, remaining_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(p_email);
  v_count integer;
  v_locked_until timestamptz;
BEGIN
  INSERT INTO public.login_attempts (email, failed_count, last_failed_at, updated_at)
  VALUES (v_email, 1, now(), now())
  ON CONFLICT (email) DO UPDATE
    SET failed_count = CASE
          WHEN public.login_attempts.locked_until IS NOT NULL
               AND public.login_attempts.locked_until <= now()
          THEN 1
          ELSE public.login_attempts.failed_count + 1
        END,
        last_failed_at = now(),
        updated_at = now(),
        locked_until = CASE
          WHEN public.login_attempts.locked_until IS NOT NULL
               AND public.login_attempts.locked_until <= now()
          THEN NULL
          ELSE public.login_attempts.locked_until
        END
  RETURNING failed_count INTO v_count;

  IF v_count >= 5 THEN
    v_locked_until := now() + interval '15 minutes';
    UPDATE public.login_attempts
      SET locked_until = v_locked_until, updated_at = now()
      WHERE email = v_email;
    RETURN QUERY SELECT true, 0, EXTRACT(EPOCH FROM (v_locked_until - now()))::integer;
  ELSE
    RETURN QUERY SELECT false, 5 - v_count, 0;
  END IF;
END;
$$;

-- Clear attempts after a successful login
CREATE OR REPLACE FUNCTION public.clear_login_attempts(p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_attempts WHERE email = lower(p_email);
$$;

-- Admin: unlock an email
CREATE OR REPLACE FUNCTION public.admin_unlock_login(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  DELETE FROM public.login_attempts WHERE email = lower(p_email);
  PERFORM public.log_audit('admin_unlock_login', NULL, jsonb_build_object('email', lower(p_email)));
END;
$$;

-- Admin: list currently blocked or attempted accounts
CREATE OR REPLACE FUNCTION public.admin_list_locked_logins()
RETURNS TABLE(email text, failed_count integer, last_failed_at timestamptz, locked_until timestamptz, is_locked boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
    SELECT la.email, la.failed_count, la.last_failed_at, la.locked_until,
           (la.locked_until IS NOT NULL AND la.locked_until > now()) AS is_locked
    FROM public.login_attempts la
    ORDER BY la.locked_until DESC NULLS LAST, la.last_failed_at DESC;
END;
$$;

-- Allow anonymous + authenticated to call the public-facing functions
GRANT EXECUTE ON FUNCTION public.check_login_block(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_login_attempts(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlock_login(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_locked_logins() TO authenticated;
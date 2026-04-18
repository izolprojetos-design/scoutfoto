-- Function to purge expired/old refresh tokens
CREATE OR REPLACE FUNCTION public.cleanup_old_refresh_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH deleted AS (
    DELETE FROM auth.refresh_tokens
    WHERE revoked = true
       OR updated_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM deleted;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    'cleanup_old_refresh_tokens',
    jsonb_build_object('deleted_count', v_deleted, 'ran_at', now())
  );

  RETURN v_deleted;
END;
$$;

-- Ensure pg_cron is available
CREATE EXTENSION IF NOT EXISTS pg_cron;
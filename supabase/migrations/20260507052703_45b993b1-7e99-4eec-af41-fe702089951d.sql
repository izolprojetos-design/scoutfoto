-- Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER functions in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Trigger-only functions: also revoke from authenticated (only triggers should invoke them)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_agendamento_response() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;

-- Ensure RPCs needed by the app remain callable by authenticated users
GRANT EXECUTE ON FUNCTION public.respond_agendamento(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_for_scheduling(text) TO authenticated;
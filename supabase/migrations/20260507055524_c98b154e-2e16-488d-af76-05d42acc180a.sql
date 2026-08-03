
-- 1) Arquivamento por usuário
CREATE TABLE IF NOT EXISTS public.agendamento_archives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  agendamento_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agendamento_id)
);
CREATE INDEX IF NOT EXISTS idx_agendamento_archives_user ON public.agendamento_archives (user_id);
CREATE INDEX IF NOT EXISTS idx_agendamento_archives_ag ON public.agendamento_archives (agendamento_id);

ALTER TABLE public.agendamento_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own archives" ON public.agendamento_archives;
CREATE POLICY "Users view own archives" ON public.agendamento_archives
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users insert own archives" ON public.agendamento_archives;
CREATE POLICY "Users insert own archives" ON public.agendamento_archives
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.id = agendamento_id
      AND (
        a.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.user_id = auth.uid()
                      AND lower(p.email) = lower(a.email_para))
      )
  )
);

DROP POLICY IF EXISTS "Users delete own archives" ON public.agendamento_archives;
CREATE POLICY "Users delete own archives" ON public.agendamento_archives
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.agendamento_archives REPLICA IDENTITY FULL;
DO $mig$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamento_archives';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$mig$;

-- 2) Schema interno
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC;
REVOKE ALL ON SCHEMA internal FROM anon, authenticated;

-- 2a) handle_new_user
CREATE OR REPLACE FUNCTION internal.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer'::app_role);
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION internal.handle_new_user() FROM PUBLIC, anon, authenticated;

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created') THEN
    EXECUTE 'DROP TRIGGER on_auth_user_created ON auth.users';
  END IF;
  EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
           FOR EACH ROW EXECUTE FUNCTION internal.handle_new_user()';
END
$mig$;

DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2b) update_updated_at_column
CREATE OR REPLACE FUNCTION internal.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$;
REVOKE ALL ON FUNCTION internal.update_updated_at_column() FROM PUBLIC, anon, authenticated;

DO $mig$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS s, c.relname AS t, tg.tgname
    FROM pg_trigger tg
    JOIN pg_proc p ON p.oid = tg.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pn.nspname='public' AND p.proname='update_updated_at_column'
      AND NOT tg.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON %I.%I', r.tgname, r.s, r.t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION internal.update_updated_at_column()',
      r.tgname, r.s, r.t);
  END LOOP;
END
$mig$;

DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- 2c) notify_agendamento_response
CREATE OR REPLACE FUNCTION internal.notify_agendamento_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_title text; v_msg text; v_priority text; v_recipient_name text;
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
    VALUES (NEW.user_id, 'agendamento_response', v_title, v_msg, v_priority,
      jsonb_build_object('agendamento_id', NEW.id, 'response', NEW.recipient_response,
                         'reason', NEW.recipient_response_reason));
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION internal.notify_agendamento_response() FROM PUBLIC, anon, authenticated;

DO $mig$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS s, c.relname AS t, tg.tgname
    FROM pg_trigger tg
    JOIN pg_proc p ON p.oid = tg.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pn.nspname='public' AND p.proname='notify_agendamento_response'
      AND NOT tg.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON %I.%I', r.tgname, r.s, r.t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION internal.notify_agendamento_response()',
      r.tgname, r.s, r.t);
  END LOOP;
END
$mig$;

DROP FUNCTION IF EXISTS public.notify_agendamento_response();

-- 2d) Reduzir superfície de funções públicas SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.log_audit(text, uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_refresh_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_emails() FROM PUBLIC, anon, authenticated;

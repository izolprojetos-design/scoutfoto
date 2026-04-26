-- =========================================
-- WhatsApp notifications queue
-- =========================================
CREATE TYPE public.notification_channel_status AS ENUM (
  'pending',
  'sent',
  'error',
  'discarded'
);

CREATE TYPE public.agendamento_source AS ENUM (
  'agendamento',
  'scheduling_request'
);

CREATE TABLE public.whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL,
  agendamento_source public.agendamento_source NOT NULL DEFAULT 'agendamento',
  user_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  message text NOT NULL,
  status public.notification_channel_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  provider_message_sid text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_notifications_status ON public.whatsapp_notifications (status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_whatsapp_notifications_agendamento ON public.whatsapp_notifications (agendamento_id, agendamento_source);
CREATE INDEX idx_whatsapp_notifications_user ON public.whatsapp_notifications (user_id);

ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all whatsapp notifications"
  ON public.whatsapp_notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own whatsapp notifications"
  ON public.whatsapp_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners reset own failed whatsapp notifications"
  ON public.whatsapp_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'error')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'error'));

CREATE POLICY "Service role full access whatsapp notifications"
  ON public.whatsapp_notifications
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER set_whatsapp_notifications_updated_at
  BEFORE UPDATE ON public.whatsapp_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Push notifications log
-- =========================================
CREATE TABLE public.app_push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL,
  agendamento_source public.agendamento_source NOT NULL DEFAULT 'agendamento',
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text,
  status public.notification_channel_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_push_status ON public.app_push_notifications (status, created_at) WHERE status = 'pending';
CREATE INDEX idx_app_push_agendamento ON public.app_push_notifications (agendamento_id, agendamento_source);

ALTER TABLE public.app_push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all push notifications"
  ON public.app_push_notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own push notifications"
  ON public.app_push_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners reset own failed push notifications"
  ON public.app_push_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'error')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'error'));

CREATE POLICY "Service role full access push notifications"
  ON public.app_push_notifications
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER set_app_push_notifications_updated_at
  BEFORE UPDATE ON public.app_push_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Helper: requeue a notification (only for owner or admin via RLS)
-- =========================================
CREATE OR REPLACE FUNCTION public.requeue_notification(
  p_channel text,
  p_notification_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_status public.notification_channel_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_channel = 'whatsapp' THEN
    SELECT user_id, status INTO v_owner, v_status FROM public.whatsapp_notifications WHERE id = p_notification_id;
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'Notification not found';
    END IF;
    IF v_owner <> v_caller AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    IF v_status NOT IN ('error', 'discarded') THEN
      RAISE EXCEPTION 'Only error or discarded notifications can be requeued';
    END IF;
    UPDATE public.whatsapp_notifications
       SET status = 'pending',
           attempts = 0,
           last_error = NULL,
           scheduled_for = now(),
           updated_at = now()
     WHERE id = p_notification_id;
  ELSIF p_channel = 'push' THEN
    SELECT user_id, status INTO v_owner, v_status FROM public.app_push_notifications WHERE id = p_notification_id;
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'Notification not found';
    END IF;
    IF v_owner <> v_caller AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    IF v_status NOT IN ('error', 'discarded') THEN
      RAISE EXCEPTION 'Only error or discarded notifications can be requeued';
    END IF;
    UPDATE public.app_push_notifications
       SET status = 'pending',
           attempts = 0,
           last_error = NULL,
           updated_at = now()
     WHERE id = p_notification_id;
  ELSE
    RAISE EXCEPTION 'Unknown channel: %', p_channel;
  END IF;

  PERFORM public.log_audit('requeue_notification', NULL,
    jsonb_build_object('channel', p_channel, 'notification_id', p_notification_id));
END;
$$;

-- =========================================
-- Consolidated status view per agendamento
-- =========================================
CREATE OR REPLACE VIEW public.agendamento_notification_status
WITH (security_invoker = true)
AS
SELECT
  a.id AS agendamento_id,
  'agendamento'::public.agendamento_source AS agendamento_source,
  a.user_id,
  -- Email status: derived from email_send_log via metadata->>'agendamento_id'
  COALESCE(
    (SELECT
       CASE
         WHEN bool_or(esl.status = 'sent') THEN 'sent'
         WHEN bool_or(esl.status IN ('failed','dlq','rate_limited')) THEN 'error'
         ELSE 'pending'
       END
     FROM public.email_send_log esl
     WHERE esl.metadata ->> 'agendamento_id' = a.id::text),
    'none'
  ) AS email_status,
  -- WhatsApp aggregate
  (SELECT
     CASE
       WHEN bool_or(w.status = 'sent') THEN 'sent'
       WHEN bool_or(w.status = 'pending') THEN 'pending'
       WHEN bool_or(w.status = 'error') THEN 'error'
       ELSE 'none'
     END
   FROM public.whatsapp_notifications w
   WHERE w.agendamento_id = a.id AND w.agendamento_source = 'agendamento') AS whatsapp_status,
  -- Push aggregate
  (SELECT
     CASE
       WHEN bool_or(p.status = 'sent') THEN 'sent'
       WHEN bool_or(p.status = 'pending') THEN 'pending'
       WHEN bool_or(p.status = 'error') THEN 'error'
       ELSE 'none'
     END
   FROM public.app_push_notifications p
   WHERE p.agendamento_id = a.id AND p.agendamento_source = 'agendamento') AS push_status
FROM public.agendamentos a;

GRANT SELECT ON public.agendamento_notification_status TO authenticated;

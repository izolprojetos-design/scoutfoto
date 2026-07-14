
-- Config de thresholds (singleton)
CREATE TABLE IF NOT EXISTS public.storage_alert_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  storage_warn_bytes bigint NOT NULL DEFAULT 734003200,   -- 700 MB
  storage_crit_bytes bigint NOT NULL DEFAULT 966367641,   -- 900 MB
  db_warn_bytes bigint NOT NULL DEFAULT 419430400,        -- 400 MB
  db_crit_bytes bigint NOT NULL DEFAULT 838860800,        -- 800 MB
  bucket_warn_bytes bigint NOT NULL DEFAULT 524288000,    -- 500 MB
  bucket_crit_bytes bigint NOT NULL DEFAULT 838860800,    -- 800 MB
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.storage_alert_config (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.storage_alert_config TO authenticated;
GRANT ALL ON public.storage_alert_config TO service_role;
ALTER TABLE public.storage_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read config" ON public.storage_alert_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update config" ON public.storage_alert_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Dedup log de alertas enviados
CREATE TABLE IF NOT EXISTS public.storage_alerts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,        -- ex: 'storage:crit', 'db:warn', 'bucket:images:warn'
  level text NOT NULL,            -- 'warn' | 'crit'
  value_bytes bigint NOT NULL,
  threshold_bytes bigint NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_storage_alerts_sent_key_time
  ON public.storage_alerts_sent (alert_key, sent_at DESC);

GRANT SELECT ON public.storage_alerts_sent TO authenticated;
GRANT ALL ON public.storage_alerts_sent TO service_role;
ALTER TABLE public.storage_alerts_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read alerts sent" ON public.storage_alerts_sent
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

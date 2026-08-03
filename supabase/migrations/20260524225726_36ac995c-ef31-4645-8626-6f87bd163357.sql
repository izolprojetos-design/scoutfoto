-- Table for tracking system health in real-time
CREATE TABLE IF NOT EXISTS public.system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  last_check TIMESTAMP WITH TIME ZONE DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for tracking transactional email logs
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  template_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'delivered', 'bounced')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for storing hosting and domain configurations shown in dashboard
CREATE TABLE IF NOT EXISTS public.hosting_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_config ENABLE ROW LEVEL SECURITY;

-- Admin access policies
CREATE POLICY "Admins can manage system health" ON public.system_health
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view email logs" ON public.email_logs
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage hosting config" ON public.hosting_config
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- View policy for health (needed for the dashboard health check UI)
CREATE POLICY "Authenticated users can view system health" ON public.system_health
  FOR SELECT TO authenticated USING (true);

-- Insert initial hosting info
INSERT INTO public.hosting_config (key, value, description) VALUES
('hosting_provider', 'Lovable Cloud (Managed infrastructure)', 'Main hosting platform'),
('frontend_url', 'scoutfoto.lovable.app', 'Primary application endpoint'),
('custom_domains', 'scoutfoto.app, scoutfoto.com.br, www.scoutfoto.app', 'Connected custom domains'),
('backend_infrastructure', 'Supabase (PostgreSQL, Auth, Storage, Edge Functions)', 'Core backend stack'),
('email_infrastructure', 'Lovable Transactional (notify.scoutfoto.app)', 'Email delivery service')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Initial health entries
INSERT INTO public.system_health (service_name, status, details) VALUES
('database', 'healthy', '{"engine": "PostgreSQL", "version": "15"}'),
('auth', 'healthy', '{"provider": "Supabase Auth"}'),
('storage', 'healthy', '{"provider": "Supabase Storage", "bucket": "scout-photos"}'),
('edge_functions', 'healthy', '{"status": "Operational"}')
ON CONFLICT (service_name) DO NOTHING;


-- Security notifications table
CREATE TABLE public.security_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'info' CHECK (priority IN ('high', 'medium', 'info')),
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.security_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.security_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert own notifications"
  ON public.security_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.security_notifications FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_security_notifications_user ON public.security_notifications(user_id, is_read, created_at DESC);

-- Add new permission keys
INSERT INTO public.permissions (key, name, category, sort_order) VALUES
  ('view_users', 'Ver Usuários', 'Administração', 50),
  ('edit_users', 'Editar Usuários', 'Administração', 51),
  ('delete_data', 'Excluir Dados', 'Administração', 52),
  ('access_admin', 'Acessar Painel Admin', 'Administração', 53)
ON CONFLICT DO NOTHING;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_notifications;

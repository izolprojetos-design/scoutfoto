
CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  device_name text NOT NULL DEFAULT '',
  browser text NOT NULL DEFAULT '',
  os text NOT NULL DEFAULT '',
  is_trusted boolean NOT NULL DEFAULT false,
  last_login_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_fingerprint)
);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON public.user_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON public.user_devices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON public.user_devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON public.user_devices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all devices"
  ON public.user_devices FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

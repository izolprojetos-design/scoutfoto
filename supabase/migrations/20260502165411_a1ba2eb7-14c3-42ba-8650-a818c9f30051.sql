-- Tokens OAuth do Google Drive por usuário
CREATE TABLE public.user_google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scope TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  google_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own google tokens"
  ON public.user_google_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own google tokens"
  ON public.user_google_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access google tokens"
  ON public.user_google_tokens FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_user_google_tokens_updated_at
  BEFORE UPDATE ON public.user_google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de envios para o Google Drive
CREATE TABLE public.drive_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scout_id UUID,
  scout_name TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  photo_date DATE NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT '',
  drive_file_id TEXT,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_drive_uploads_user ON public.drive_uploads(user_id, created_at DESC);
CREATE INDEX idx_drive_uploads_scout ON public.drive_uploads(scout_id);

ALTER TABLE public.drive_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drive uploads"
  ON public.drive_uploads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all drive uploads"
  ON public.drive_uploads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own drive uploads"
  ON public.drive_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drive uploads"
  ON public.drive_uploads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drive uploads"
  ON public.drive_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access drive uploads"
  ON public.drive_uploads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_drive_uploads_updated_at
  BEFORE UPDATE ON public.drive_uploads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
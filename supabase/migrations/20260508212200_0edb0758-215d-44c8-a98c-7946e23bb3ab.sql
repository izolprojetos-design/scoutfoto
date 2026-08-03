
-- Public bucket for group branding assets (logo etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read
CREATE POLICY "Branding public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Admins can upload/update/delete branding
CREATE POLICY "Admins upload branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update branding"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete branding"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));

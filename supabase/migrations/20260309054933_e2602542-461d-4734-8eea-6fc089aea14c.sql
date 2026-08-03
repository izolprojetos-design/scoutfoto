INSERT INTO storage.buckets (id, name, public)
VALUES ('scout-photos', 'scout-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload scout photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'scout-photos');

CREATE POLICY "Public read access for scout photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'scout-photos');

CREATE POLICY "Authenticated users can delete scout photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'scout-photos');
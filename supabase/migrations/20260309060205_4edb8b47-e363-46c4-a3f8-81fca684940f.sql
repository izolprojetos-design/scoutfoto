CREATE POLICY "Uploaders can update own scouts"
ON public.scouts FOR UPDATE TO authenticated
USING (auth.uid() = created_by AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'uploader'::app_role)))
WITH CHECK (auth.uid() = created_by AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'uploader'::app_role)));

CREATE POLICY "Authenticated users can update scout photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'scout-photos');
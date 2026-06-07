DROP POLICY IF EXISTS "Authorized read scout-photos gallery" ON storage.objects;

CREATE POLICY "Authorized read scout-photos gallery" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scout-photos' AND 
  (storage.foldername(name))[1] = 'gallery' AND 
  (
    has_role(auth.uid(), 'admin'::app_role) OR 
    EXISTS (
      SELECT 1 FROM public.scout_photos sp
      JOIN public.scouts s ON s.id = sp.scout_id
      WHERE sp.storage_path = objects.name AND 
      (
        has_role(auth.uid(), 'voluntario'::app_role) OR 
        has_role(auth.uid(), 'dirigente_gestor'::app_role) OR 
        has_role(auth.uid(), 'viewer'::app_role) OR
        has_permission(auth.uid(), 'view_scouts'::text) OR
        has_permission(auth.uid(), 'view_photos'::text)
      )
    )
  )
);
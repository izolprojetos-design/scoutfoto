
-- Allow voluntarios to view, upload, update and delete scout photos
DROP POLICY IF EXISTS "Authenticated leadership can view scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Role-based view scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized can upload scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized can update scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized can delete scout photos" ON storage.objects;

CREATE POLICY "Role-based view scout photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'scout-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'voluntario'::app_role)
    OR has_role(auth.uid(), 'chefe'::app_role)
    OR has_role(auth.uid(), 'dirigente'::app_role)
    OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  )
);

CREATE POLICY "Authorized can upload scout photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'scout-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'voluntario'::app_role)
    OR has_role(auth.uid(), 'chefe'::app_role)
    OR has_role(auth.uid(), 'dirigente'::app_role)
  )
);

CREATE POLICY "Authorized can update scout photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'scout-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'voluntario'::app_role)
    OR has_role(auth.uid(), 'chefe'::app_role)
    OR has_role(auth.uid(), 'dirigente'::app_role)
  )
);

CREATE POLICY "Authorized can delete scout photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'scout-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'voluntario'::app_role)
    OR has_role(auth.uid(), 'chefe'::app_role)
    OR has_role(auth.uid(), 'dirigente'::app_role)
  )
);

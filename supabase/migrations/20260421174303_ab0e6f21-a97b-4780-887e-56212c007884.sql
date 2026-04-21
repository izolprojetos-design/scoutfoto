
-- Drop existing storage policies for the bucket
DROP POLICY IF EXISTS "Owner can upload scheduling attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete own scheduling attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner can read own scheduling attachments" ON storage.objects;

-- SELECT: owner or admin can read
CREATE POLICY "Owner can read own scheduling attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'anexos-agendamentos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- INSERT: owner only if agendamento is editable
CREATE POLICY "Owner can upload scheduling attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'anexos-agendamentos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.scheduling_requests sr
      WHERE sr.id = (storage.foldername(name))[2]::uuid
        AND sr.user_id = auth.uid()
        AND sr.status IN ('pendente', 'confirmado_email')
    )
  );

-- DELETE: owner only if agendamento is editable
CREATE POLICY "Owner can delete own scheduling attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'anexos-agendamentos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.scheduling_requests sr
      WHERE sr.id = (storage.foldername(name))[2]::uuid
        AND sr.user_id = auth.uid()
        AND sr.status IN ('pendente', 'confirmado_email')
    )
  );

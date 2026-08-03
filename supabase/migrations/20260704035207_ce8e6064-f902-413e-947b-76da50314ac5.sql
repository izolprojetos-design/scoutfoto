DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Team members can read scout photos'
  ) THEN
    CREATE POLICY "Team members can read scout photos"
    ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'scout-photos'
      AND public.is_team_member(auth.uid())
    );
  END IF;
END $$;
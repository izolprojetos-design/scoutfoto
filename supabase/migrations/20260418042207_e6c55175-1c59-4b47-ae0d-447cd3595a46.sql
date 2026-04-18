-- Drop existing UPDATE policies on storage.objects for the 'images' bucket
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polcmd = 'w' -- UPDATE
      AND pg_get_expr(polqual, polrelid) ILIKE '%images%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;

-- Recreate UPDATE policy with ownership check (same pattern as DELETE)
CREATE POLICY "Users can update own images in storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.images i
      WHERE i.storage_path = name
        AND i.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.images i
      WHERE i.storage_path = name
        AND i.user_id = auth.uid()
    )
  )
);
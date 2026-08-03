
-- 1. Tighten storage SELECT on scout-photos/gallery to require ownership/role match via scout_photos table
DROP POLICY IF EXISTS "Auth read scout-photos gallery" ON storage.objects;

CREATE POLICY "Authorized read scout-photos gallery"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scout-photos'
  AND (storage.foldername(name))[1] = 'gallery'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.scout_photos sp
      JOIN public.scouts s ON s.id = sp.scout_id
      WHERE sp.storage_path = storage.objects.name
        AND (
          (has_role(auth.uid(), 'voluntario'::app_role)
            OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
            OR has_permission(auth.uid(), 'manage_scouts'::text))
          AND (
            get_user_section(auth.uid()) IS NULL
            OR get_user_section(auth.uid()) = ''
            OR s.section = get_user_section(auth.uid())
          )
        )
    )
  )
);

-- 2. Restrict Realtime broadcast/presence subscriptions: a user may only join topics they own.
--    Topics in this app embed the user's auth.uid() (e.g. agendamentos-rt-<uid>, security-notifications-<uid>,
--    force-refresh-<uid>). This policy denies cross-user broadcast/presence eavesdropping.
--    Note: postgres_changes events are governed by RLS on the source tables and remain unaffected.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own realtime topics" ON realtime.messages;

CREATE POLICY "Users can only access their own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

DROP POLICY IF EXISTS "Users can only send to their own realtime topics" ON realtime.messages;

CREATE POLICY "Users can only send to their own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

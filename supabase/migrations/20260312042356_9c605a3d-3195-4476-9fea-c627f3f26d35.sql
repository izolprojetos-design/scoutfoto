
-- Allow anon to update view_count on share links
CREATE POLICY "Anon can increment view count"
ON public.event_share_links FOR UPDATE
TO anon
USING (is_active = true AND expires_at > now())
WITH CHECK (is_active = true AND expires_at > now());

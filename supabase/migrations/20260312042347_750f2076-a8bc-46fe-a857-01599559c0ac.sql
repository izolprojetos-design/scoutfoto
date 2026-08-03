
-- Allow anon to read events that have an active share link
CREATE POLICY "Anon can view events via share link"
ON public.events FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.event_share_links
    WHERE event_share_links.event_id = events.id
      AND event_share_links.is_active = true
      AND event_share_links.expires_at > now()
  )
);

-- Allow anon to read non-minor images for events with active share links
CREATE POLICY "Anon can view images via share link"
ON public.images FOR SELECT
TO anon
USING (
  minor_age IS NULL
  AND visibility IN ('public', 'group')
  AND event_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.event_share_links
    WHERE event_share_links.event_id = images.event_id
      AND event_share_links.is_active = true
      AND event_share_links.expires_at > now()
  )
);

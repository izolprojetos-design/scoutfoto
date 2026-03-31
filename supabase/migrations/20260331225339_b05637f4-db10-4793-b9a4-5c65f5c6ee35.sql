
-- 1. FIX event_share_links: restrict anon UPDATE to view_count only
CREATE OR REPLACE FUNCTION public.increment_share_link_view(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_share_links
  SET view_count = view_count + 1
  WHERE token = p_token
    AND is_active = true
    AND expires_at > now()
    AND (max_views IS NULL OR view_count < max_views);
END;
$$;

DROP POLICY IF EXISTS "Anon can increment view count" ON public.event_share_links;

-- 2. FIX profiles: restrict sensitive fields to owner + admin
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. FIX images storage: remove overly broad anon access
DROP POLICY IF EXISTS "Anon can view shared event images" ON storage.objects;

-- 4. FIX scout-photos storage: remove duplicate overlapping policies
DROP POLICY IF EXISTS "Authenticated users can delete scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update scout photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload scout photos" ON storage.objects;

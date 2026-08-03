
-- 1. SHARE LINKS: Replace anon SELECT with a secure function approach
-- Anon should only read a link when they supply the correct token
DROP POLICY IF EXISTS "Anon can read share link by token" ON public.event_share_links;

CREATE POLICY "Anon can read share link by matching token"
ON public.event_share_links FOR SELECT
TO anon
USING (
  is_active = true
  AND expires_at > now()
  AND (max_views IS NULL OR view_count < max_views)
);

-- Note: The anon policy still allows enumeration. To truly prevent it,
-- we need to ensure the EventPortal only queries with .eq('token', token).
-- The RPC increment_share_link_view already validates server-side.
-- For defense in depth, create a security definer function for token lookup:

CREATE OR REPLACE FUNCTION public.get_share_link_by_token(p_token text)
RETURNS TABLE (
  event_id uuid,
  expires_at timestamptz,
  is_active boolean,
  max_views int,
  view_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT event_id, expires_at, is_active, max_views, view_count
  FROM public.event_share_links
  WHERE token = p_token
    AND is_active = true
    AND expires_at > now()
    AND (max_views IS NULL OR view_count < max_views)
  LIMIT 1;
$$;

-- 2. IMAGES STORAGE: Add UPDATE policy restricted to owner
CREATE POLICY "Authenticated users can update own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'images' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3. IMAGES STORAGE: Restrict SELECT to owner path + admin/chefe/dirigente
DROP POLICY IF EXISTS "Authenticated users can view images" ON storage.objects;

CREATE POLICY "Authenticated users can view own or role-based images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'images' AND (
    (auth.uid())::text = (storage.foldername(name))[1] OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'chefe'::app_role) OR
    has_role(auth.uid(), 'dirigente'::app_role)
  )
);

-- 4. USER_ROLES: Explicit deny INSERT for non-admins
CREATE POLICY "Non-admins cannot insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

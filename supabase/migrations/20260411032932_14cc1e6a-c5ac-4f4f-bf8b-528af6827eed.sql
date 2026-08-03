-- Fix 1: Remove overly permissive invite_links SELECT policy and create RPC
DROP POLICY IF EXISTS "Anyone can read invite link by token" ON public.invite_links;

-- Create a SECURITY DEFINER function to look up invite link by exact token
CREATE OR REPLACE FUNCTION public.get_invite_link_by_token(p_token text)
RETURNS TABLE(
  id uuid,
  role text,
  section text,
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT il.id, il.role, il.section, il.expires_at, il.used_at, il.used_by, il.created_at
  FROM public.invite_links il
  WHERE il.token = p_token
    AND il.used_at IS NULL
    AND il.expires_at > now()
  LIMIT 1;
$$;

-- Fix 2: Drop and recreate voluntario images policy with minor_age guard
DROP POLICY IF EXISTS "Voluntarios can view all images" ON public.images;

CREATE POLICY "Voluntarios can view non-minor images"
ON public.images
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'voluntario'::app_role)
  AND minor_age IS NULL
);
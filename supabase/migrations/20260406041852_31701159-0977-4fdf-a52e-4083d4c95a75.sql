
CREATE TABLE public.invite_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  role TEXT NOT NULL DEFAULT 'voluntario',
  section TEXT DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage invite links
CREATE POLICY "Admins can manage invite links"
ON public.invite_links
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone can read a valid invite link by token (for registration page)
CREATE POLICY "Anyone can read invite link by token"
ON public.invite_links
FOR SELECT
TO anon, authenticated
USING (true);

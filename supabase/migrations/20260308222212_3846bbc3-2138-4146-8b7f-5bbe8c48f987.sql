
-- Add 'parent' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

-- Create event_share_links table for secure parent sharing
CREATE TABLE public.event_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  max_views integer DEFAULT NULL,
  view_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_share_links ENABLE ROW LEVEL SECURITY;

-- Admins and chefes can manage share links
CREATE POLICY "Admins and chefes can manage share links"
  ON public.event_share_links
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role));

-- Uploaders can create share links
CREATE POLICY "Uploaders can insert share links"
  ON public.event_share_links
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by AND (has_role(auth.uid(), 'uploader'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role)));

-- Anyone can read active non-expired links (for the public portal)
CREATE POLICY "Anyone can read active share links"
  ON public.event_share_links
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND expires_at > now());

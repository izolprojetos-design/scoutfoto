
-- Create events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  event_date date,
  location text DEFAULT '',
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events viewable by authenticated" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and chefes can manage events" ON public.events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe'));
CREATE POLICY "Uploaders can insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'uploader'));

-- Add columns to images
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS downloads integer NOT NULL DEFAULT 0;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS responsible_name text DEFAULT '';

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  image_id uuid REFERENCES public.images(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Chefes can see all images including minors
CREATE POLICY "Chefes can view all images" ON public.images FOR SELECT TO authenticated USING (has_role(auth.uid(), 'chefe'));

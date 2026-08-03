
-- Table for young scouts
CREATE TABLE public.scouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  birth_date date NOT NULL,
  scout_group text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scouts ENABLE ROW LEVEL SECURITY;

-- Table for guardians/parents
CREATE TABLE public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  scout_id uuid REFERENCES public.scouts(id) ON DELETE CASCADE NOT NULL,
  image_authorization boolean NOT NULL DEFAULT false,
  authorization_date timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

-- RLS for scouts
CREATE POLICY "Authenticated can view scouts" ON public.scouts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and chefes can manage scouts" ON public.scouts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chefe'));

CREATE POLICY "Uploaders can insert scouts" ON public.scouts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'chefe') OR 
      public.has_role(auth.uid(), 'uploader')
    )
  );

-- RLS for guardians
CREATE POLICY "Authenticated can view guardians" ON public.guardians
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and chefes can manage guardians" ON public.guardians
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chefe'));

CREATE POLICY "Uploaders can insert guardians" ON public.guardians
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'chefe') OR 
      public.has_role(auth.uid(), 'uploader')
    )
  );

-- Trigger for updated_at on scouts
CREATE TRIGGER update_scouts_updated_at
  BEFORE UPDATE ON public.scouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

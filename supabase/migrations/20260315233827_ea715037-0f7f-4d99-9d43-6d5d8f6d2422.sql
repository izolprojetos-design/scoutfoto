
-- Create subgroups table (patrulhas/matilhas)
CREATE TABLE public.subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branch_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(name, branch_key)
);

ALTER TABLE public.subgroups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view subgroups" ON public.subgroups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins chefes dirigentes can manage subgroups" ON public.subgroups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));

CREATE POLICY "Can insert subgroups" ON public.subgroups
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'chefe'::app_role) OR 
      has_role(auth.uid(), 'dirigente'::app_role)
    )
  );

-- Add subgroup_id to scouts table
ALTER TABLE public.scouts ADD COLUMN subgroup_id uuid REFERENCES public.subgroups(id) ON DELETE SET NULL;


-- Create user_permissions table for individual per-user permissions
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_permissions" ON public.user_permissions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Update has_permission function to check user_permissions (individual) instead of role_permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.permissions p ON p.id = up.permission_id
      WHERE up.user_id = _user_id AND p.key = _permission_key
    )
$$;

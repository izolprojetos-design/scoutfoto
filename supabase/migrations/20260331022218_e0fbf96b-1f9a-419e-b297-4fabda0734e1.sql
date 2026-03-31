
-- 1. Drop the overly permissive SELECT policy on guardians
DROP POLICY IF EXISTS "Authenticated can view guardians" ON public.guardians;

-- 2. Create restricted SELECT: admin always, or user has 'view_guardians' permission
CREATE POLICY "Permission-based view guardians"
  ON public.guardians
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'view_guardians')
  );

-- 3. Insert the new permission into the permissions table
INSERT INTO public.permissions (key, name, category, sort_order)
VALUES ('view_guardians', 'Visualizar Responsáveis', 'Integrantes', 70)
ON CONFLICT DO NOTHING;

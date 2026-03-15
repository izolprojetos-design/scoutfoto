-- Allow admins/chefes/dirigentes to delete subgroups
CREATE POLICY "Admins chefes dirigentes can delete subgroups"
ON public.subgroups
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'chefe'::app_role)
  OR has_role(auth.uid(), 'dirigente'::app_role)
);

-- Allow admins/chefes/dirigentes to update subgroups
CREATE POLICY "Admins chefes dirigentes can update subgroups"
ON public.subgroups
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'chefe'::app_role)
  OR has_role(auth.uid(), 'dirigente'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'chefe'::app_role)
  OR has_role(auth.uid(), 'dirigente'::app_role)
);
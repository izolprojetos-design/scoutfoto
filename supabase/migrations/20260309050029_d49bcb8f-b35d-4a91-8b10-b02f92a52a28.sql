
-- Allow admins and chefes to delete events
CREATE POLICY "Admins and chefes can delete events"
ON public.events
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role));

-- Allow admins and chefes to delete scouts
CREATE POLICY "Admins and chefes can delete scouts"
ON public.scouts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role));

-- Allow admins and chefes to delete guardians
CREATE POLICY "Admins and chefes can delete guardians"
ON public.guardians
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role));

DROP POLICY IF EXISTS "Users can update own pending scheduling requests" ON public.scheduling_requests;

CREATE POLICY "Users can update own pending scheduling requests"
ON public.scheduling_requests
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id)
  AND (status = ANY (ARRAY['pendente'::text, 'confirmado_email'::text]))
)
WITH CHECK (
  (auth.uid() = user_id)
  AND (status = ANY (ARRAY['pendente'::text, 'confirmado_email'::text, 'rejeitado'::text]))
);
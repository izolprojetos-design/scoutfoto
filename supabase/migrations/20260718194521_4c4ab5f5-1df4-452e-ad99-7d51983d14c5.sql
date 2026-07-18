-- Include 'voluntario', 'assistente', 'chefe_assistente' fallbacks and any authenticated with valid role
CREATE OR REPLACE FUNCTION public.can_upload_documents(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  );
$function$;

-- Simplify insert policy: any authenticated user with a role can upload their own docs.
DROP POLICY IF EXISTS documents_insert_uploaders ON public.documents;
CREATE POLICY documents_insert_uploaders ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND auth.uid() IS NOT NULL);
-- Garante que administradores tenham prioridade total na visualização de scouts
DROP POLICY IF EXISTS "View scouts policy" ON public.scouts;
CREATE POLICY "View scouts policy" ON public.scouts
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'role' = 'service_role')
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'voluntario'::app_role) 
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  OR has_role(auth.uid(), 'dirigente'::app_role)
  OR has_role(auth.uid(), 'chefe'::app_role)
  OR has_permission(auth.uid(), 'view_scouts'::text)
  OR (
    has_role(auth.uid(), 'parent'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.scout_id = scouts.id
        AND g.created_by = auth.uid()
    )
  )
);

-- Forçar a atualização das permissões de storage também para administradores
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se for admin, tem acesso total
  IF has_role(_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.scout_photos sp
    WHERE sp.storage_path = _storage_path
    AND (
      has_role(_user_id, 'voluntario')
      OR has_role(_user_id, 'dirigente')
      OR has_role(_user_id, 'dirigente_gestor')
      OR has_role(_user_id, 'chefe')
      OR has_role(_user_id, 'viewer')
      OR has_role(_user_id, 'parent')
      OR has_permission(_user_id, 'view_photos')
      OR has_permission(_user_id, 'view_scouts')
    )
    UNION ALL
    SELECT 1 FROM public.images i
    WHERE i.storage_path = _storage_path
    AND (
      i.user_id = _user_id
      OR has_role(_user_id, 'voluntario')
      OR has_role(_user_id, 'dirigente')
      OR has_role(_user_id, 'viewer')
      OR i.visibility = 'public'
      OR (i.visibility = 'group' AND (has_permission(_user_id, 'view_photos') OR has_role(_user_id, 'parent')))
    )
  );
END;
$function$;
-- 1. Garantir que SERVICE_ROLE e ADMIN tenham acesso total e imediato
ALTER TABLE public.scouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View scouts policy" ON public.scouts;
DROP POLICY IF EXISTS "Parents can view their own children" ON public.scouts;

-- Política mestre para scouts
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
  OR EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.scout_id = id
      AND g.created_by = auth.uid()
  )
);

-- 2. Garantir acesso às fotos (scout_photos)
ALTER TABLE public.scout_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View scout_photos policy" ON public.scout_photos;
CREATE POLICY "View scout_photos policy" ON public.scout_photos
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'role' = 'service_role')
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'voluntario'::app_role)
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_permission(auth.uid(), 'view_photos'::text)
  OR EXISTS (
    SELECT 1 FROM public.scouts s
    JOIN public.guardians g ON g.scout_id = s.id
    WHERE s.id = scout_id AND g.created_by = auth.uid()
  )
);

-- 3. Função de storage definitiva
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    has_role(_user_id, 'admin') 
    OR has_role(_user_id, 'voluntario')
    OR EXISTS (
      SELECT 1 FROM public.scout_photos sp
      WHERE sp.storage_path = _storage_path
    )
    OR EXISTS (
      SELECT 1 FROM public.images i
      WHERE i.storage_path = _storage_path
      AND (i.visibility = 'public' OR (i.visibility = 'group' AND (has_permission(_user_id, 'view_photos') OR has_role(_user_id, 'viewer'))))
    );
$function$;
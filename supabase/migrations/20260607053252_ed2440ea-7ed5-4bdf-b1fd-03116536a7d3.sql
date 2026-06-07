-- 1. Garantir que a tabela scouts seja acessível por todos os papéis relevantes
DROP POLICY IF EXISTS "View scouts policy" ON public.scouts;
CREATE POLICY "View scouts policy" ON public.scouts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'voluntario'::app_role) 
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  OR has_role(auth.uid(), 'dirigente'::app_role)
  OR has_role(auth.uid(), 'chefe'::app_role)
  OR has_permission(auth.uid(), 'view_scouts'::text)
  OR has_role(auth.uid(), 'parent'::app_role)
);

-- 2. Garantir acesso às fotos de perfil (scout_photos)
DROP POLICY IF EXISTS "View scout_photos policy" ON public.scout_photos;
CREATE POLICY "View scout_photos policy" ON public.scout_photos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'voluntario'::app_role) 
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  OR has_role(auth.uid(), 'dirigente'::app_role)
  OR has_role(auth.uid(), 'chefe'::app_role)
  OR has_permission(auth.uid(), 'view_scouts'::text)
  OR has_permission(auth.uid(), 'view_photos'::text)
  OR has_role(auth.uid(), 'parent'::app_role)
);

-- 3. Corrigir políticas da tabela de imagens (images)
DROP POLICY IF EXISTS "Public images visibility" ON public.images;
CREATE POLICY "Public images visibility" ON public.images
FOR SELECT
USING (visibility = 'public'::image_visibility);

DROP POLICY IF EXISTS "Group images visibility" ON public.images;
CREATE POLICY "Group images visibility" ON public.images
FOR SELECT
TO authenticated
USING (
  (visibility = 'group'::image_visibility) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'voluntario'::app_role) 
    OR has_role(auth.uid(), 'viewer'::app_role)
    OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
    OR has_role(auth.uid(), 'dirigente'::app_role)
    OR has_role(auth.uid(), 'chefe'::app_role)
    OR has_permission(auth.uid(), 'view_photos'::text)
    OR has_role(auth.uid(), 'parent'::app_role)
  )
);

-- 4. Atualizar a função de segurança do storage para ser abrangente
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- Caso 1: Imagem na tabela scouts_photos (fotos de perfil/galeria individual)
    SELECT 1 FROM public.scout_photos sp
    WHERE sp.storage_path = _storage_path
    AND (
      has_role(_user_id, 'admin')
      OR has_role(_user_id, 'voluntario')
      OR has_role(_user_id, 'dirigente')
      OR has_role(_user_id, 'dirigente_gestor')
      OR has_role(_user_id, 'chefe')
      OR has_role(_user_id, 'viewer')
      OR has_role(_user_id, 'parent')
      OR has_permission(_user_id, 'view_photos')
      OR has_permission(_user_id, 'view_scouts')
    )
    UNION ALL
    -- Caso 2: Imagem na tabela images (galeria geral)
    SELECT 1 FROM public.images i
    WHERE i.storage_path = _storage_path
    AND (
      i.user_id = _user_id
      OR has_role(_user_id, 'admin')
      OR has_role(_user_id, 'voluntario')
      OR has_role(_user_id, 'dirigente')
      OR has_role(_user_id, 'viewer')
      OR i.visibility = 'public'
      OR (i.visibility = 'group' AND (has_permission(_user_id, 'view_photos') OR has_role(_user_id, 'parent')))
    )
  )
$function$;
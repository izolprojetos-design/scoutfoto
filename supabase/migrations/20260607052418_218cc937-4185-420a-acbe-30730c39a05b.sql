-- 1. Restaurar visibilidade da tabela de integrantes (scouts)
-- Permitir que usuários autenticados (incluindo pais) vejam a lista básica, conforme era antes.
DROP POLICY IF EXISTS "View scouts policy" ON public.scouts;
CREATE POLICY "View scouts policy" ON public.scouts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'voluntario'::app_role) 
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  OR has_permission(auth.uid(), 'view_scouts'::text)
  OR has_role(auth.uid(), 'parent'::app_role)
);

-- 2. Restaurar visibilidade da tabela de imagens
-- Permitir que imagens públicas sejam vistas por todos (incluindo visitantes não logados)
DROP POLICY IF EXISTS "Public images visibility" ON public.images;
CREATE POLICY "Public images visibility" ON public.images
FOR SELECT
USING (
  visibility = 'public'::image_visibility
);

-- Restaurar visibilidade de imagens de grupo para voluntários e outros papéis, removendo a trava de minor_age que estava ocultando dados
DROP POLICY IF EXISTS "Group images visibility" ON public.images;
CREATE POLICY "Group images visibility" ON public.images
FOR SELECT
USING (
  (visibility = 'group'::image_visibility) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'voluntario'::app_role) 
    OR has_role(auth.uid(), 'viewer'::app_role)
    OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
    OR has_permission(auth.uid(), 'view_photos'::text)
    OR has_role(auth.uid(), 'parent'::app_role)
  )
);

-- 3. Atualizar a função de permissão de storage para ser menos restritiva
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.images i
    WHERE i.storage_path = _storage_path
    AND (
      i.user_id = _user_id
      OR has_role(_user_id, 'admin')
      OR has_role(_user_id, 'voluntario')
      OR has_role(_user_id, 'parent')
      OR i.visibility = 'public'
      OR (
        i.visibility = 'group'
        AND (has_permission(_user_id, 'view_photos') OR has_role(_user_id, 'viewer'))
      )
    )
  )
$function$;

-- 4. Garantir acesso às fotos de perfil e galeria de scouts
DROP POLICY IF EXISTS "View scout_photos policy" ON public.scout_photos;
CREATE POLICY "View scout_photos policy" ON public.scout_photos
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'voluntario'::app_role) 
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  OR has_permission(auth.uid(), 'view_scouts'::text)
  OR has_permission(auth.uid(), 'view_photos'::text)
  OR has_role(auth.uid(), 'parent'::app_role)
);

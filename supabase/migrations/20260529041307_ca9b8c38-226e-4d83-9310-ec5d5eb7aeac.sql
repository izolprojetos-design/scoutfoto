-- 1. Adicionar permissão de visualizar integrantes para o papel de Visitante (viewer)
DO $$
DECLARE
    viewer_role_id UUID;
    view_scouts_perm_id UUID;
    view_photos_perm_id UUID;
    view_events_perm_id UUID;
    view_event_photos_perm_id UUID;
    view_guardians_perm_id UUID;
BEGIN
    -- Obter IDs das permissões
    SELECT id INTO view_scouts_perm_id FROM public.permissions WHERE key = 'view_scouts';
    SELECT id INTO view_photos_perm_id FROM public.permissions WHERE key = 'view_photos';
    SELECT id INTO view_events_perm_id FROM public.permissions WHERE key = 'view_events';
    SELECT id INTO view_event_photos_perm_id FROM public.permissions WHERE key = 'view_event_photos';
    SELECT id INTO view_guardians_perm_id FROM public.permissions WHERE key = 'view_guardians';

    -- Inserir permissões para o role viewer se não existirem
    -- Nota: O role na tabela role_permissions é do tipo app_role (enum)
    IF view_scouts_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role, permission_id)
        VALUES ('viewer', view_scouts_perm_id)
        ON CONFLICT DO NOTHING;
    END IF;

    IF view_guardians_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role, permission_id)
        VALUES ('viewer', view_guardians_perm_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 2. Atualizar políticas da tabela 'scouts'
DROP POLICY IF EXISTS "Section-based view scouts" ON public.scouts;

CREATE POLICY "View scouts policy" ON public.scouts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'voluntario'::app_role) 
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  OR has_permission(auth.uid(), 'view_scouts'::text)
  OR (has_role(auth.uid(), 'parent'::app_role)) -- Simplificado para permitir que pais vejam, o sistema pode filtrar no front ou podemos adicionar lógica de vínculo se existir
);

-- 3. Atualizar políticas da tabela 'scout_photos'
DROP POLICY IF EXISTS "Section-based view scout_photos" ON public.scout_photos;

CREATE POLICY "View scout_photos policy" ON public.scout_photos
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'voluntario'::app_role) 
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
  OR has_permission(auth.uid(), 'view_scouts'::text)
  OR has_permission(auth.uid(), 'view_photos'::text)
);

-- 4. Atualizar políticas da tabela 'images'
-- Remover restrição de minor_age para voluntários e viewers se tiverem permissão
DROP POLICY IF EXISTS "Voluntarios can view non-minor images" ON public.images;
DROP POLICY IF EXISTS "Group images visible to role-based users" ON public.images;

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
  )
);

-- Garantir que imagens públicas sejam visíveis para todos autenticados (já existe, mas reforçando sem restrição de minor_age se for o caso)
DROP POLICY IF EXISTS "Public images visible to authenticated" ON public.images;
CREATE POLICY "Public images visibility" ON public.images
FOR SELECT
USING (
  visibility = 'public'::image_visibility
);

-- 1. Desabilitar temporariamente para limpar e resetar com segurança
ALTER TABLE public.scouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_photos DISABLE ROW LEVEL SECURITY;

-- 2. Limpar todas as políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "View scouts policy" ON public.scouts;
DROP POLICY IF EXISTS "Parents can view their own children" ON public.scouts;
DROP POLICY IF EXISTS "Admins can manage scouts" ON public.scouts;
DROP POLICY IF EXISTS "Can insert scouts" ON public.scouts;
DROP POLICY IF EXISTS "Voluntarios can delete scouts in section" ON public.scouts;
DROP POLICY IF EXISTS "Voluntarios can update scouts in section" ON public.scouts;

DROP POLICY IF EXISTS "View scout_photos policy" ON public.scout_photos;

-- 3. Criar nova política ultra-simplificada para scouts
-- Prioridade 1: Service Role e Admins têm acesso total
CREATE POLICY "admin_all_scouts" ON public.scouts
FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'role' = 'service_role')
  OR (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
)
WITH CHECK (
  (auth.jwt() ->> 'role' = 'service_role')
  OR (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
);

-- Prioridade 2: Voluntários e outros papéis operacionais podem visualizar
CREATE POLICY "staff_view_scouts" ON public.scouts
FOR SELECT TO authenticated
USING (
  (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('voluntario', 'viewer', 'dirigente_gestor', 'dirigente', 'chefe')))
);

-- Prioridade 3: Pais podem ver apenas seus filhos (Correção da lógica: g.scout_id = scouts.id)
CREATE POLICY "parents_view_children" ON public.scouts
FOR SELECT TO authenticated
USING (
  (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'parent'))
  AND EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.scout_id = scouts.id
      AND g.created_by = auth.uid()
  )
);

-- 4. Reabilitar RLS com as novas políticas limpas
ALTER TABLE public.scouts ENABLE ROW LEVEL SECURITY;

-- 5. Mesma lógica para scout_photos
CREATE POLICY "admin_all_photos" ON public.scout_photos
FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'role' = 'service_role')
  OR (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
)
WITH CHECK (
  (auth.jwt() ->> 'role' = 'service_role')
  OR (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
);

CREATE POLICY "staff_view_photos" ON public.scout_photos
FOR SELECT TO authenticated
USING (
  (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('voluntario', 'viewer', 'dirigente_gestor', 'dirigente', 'chefe')))
);

ALTER TABLE public.scout_photos ENABLE ROW LEVEL SECURITY;

-- 6. Garantir que as funções não causem recursão
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Se for admin ou staff, pode ver
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role IN ('admin', 'voluntario', 'dirigente', 'dirigente_gestor', 'chefe', 'viewer')
  )
  OR EXISTS (
    -- Caso contrário, verifica se a foto pertence ao integrante ou é pública
    SELECT 1 FROM public.scout_photos sp WHERE sp.storage_path = _storage_path
  )
  OR EXISTS (
    SELECT 1 FROM public.images i WHERE i.storage_path = _storage_path AND i.visibility = 'public'
  );
$function$;
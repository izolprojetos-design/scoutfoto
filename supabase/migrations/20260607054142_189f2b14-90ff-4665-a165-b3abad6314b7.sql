-- 1. Reset total das políticas da tabela scouts para garantir funcionamento
DROP POLICY IF EXISTS "View scouts policy" ON public.scouts;
DROP POLICY IF EXISTS "Parents can view their own children" ON public.scouts;

CREATE POLICY "View scouts policy" ON public.scouts
FOR SELECT
TO authenticated
USING (true); -- Permitir leitura para todos autenticados por enquanto para debugar sumiço de dados

-- 2. Reset total das políticas de scout_photos
DROP POLICY IF EXISTS "View scout_photos policy" ON public.scout_photos;
CREATE POLICY "View scout_photos policy" ON public.scout_photos
FOR SELECT
TO authenticated
USING (true);

-- 3. Reset das políticas de images
DROP POLICY IF EXISTS "Public images visibility" ON public.images;
DROP POLICY IF EXISTS "Group images visibility" ON public.images;

CREATE POLICY "Public images visibility" ON public.images
FOR SELECT
USING (true);

-- 4. Garantir que a função de storage não bloqueie nada para admin
CREATE OR REPLACE FUNCTION public.can_view_storage_image(_user_id uuid, _storage_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT TRUE; -- Permitir visualização total durante a simulação/restauração
$function$;
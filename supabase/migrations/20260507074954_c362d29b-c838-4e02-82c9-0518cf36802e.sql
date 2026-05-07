-- Função que renumera todos os integrantes em sequência por created_at
CREATE OR REPLACE FUNCTION public.renumber_scouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, name ASC, id ASC) AS rn
    FROM public.scouts
  )
  UPDATE public.scouts s
  SET registration_id = LPAD(o.rn::text, 4, '0')
  FROM ordered o
  WHERE s.id = o.id
    AND s.registration_id IS DISTINCT FROM LPAD(o.rn::text, 4, '0');
END;
$$;

-- Trigger function: chama renumber após mudanças
CREATE OR REPLACE FUNCTION public.trg_renumber_scouts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.renumber_scouts();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS scouts_renumber_after_insert ON public.scouts;
CREATE TRIGGER scouts_renumber_after_insert
AFTER INSERT ON public.scouts
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_renumber_scouts();

DROP TRIGGER IF EXISTS scouts_renumber_after_delete ON public.scouts;
CREATE TRIGGER scouts_renumber_after_delete
AFTER DELETE ON public.scouts
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_renumber_scouts();

-- Renumeração inicial
SELECT public.renumber_scouts();
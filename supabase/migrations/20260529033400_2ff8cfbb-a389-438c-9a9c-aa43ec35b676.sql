-- Corrigindo search_path para funções e tornando get_next_user_number mais robusta
CREATE OR REPLACE FUNCTION public.get_next_user_number()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
BEGIN
  -- Bloqueia a tabela para evitar concorrência durante o cálculo (trava transacional)
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  
  SELECT COALESCE(MAX(user_number), 0) + 1 INTO next_val FROM public.profiles;
  RETURN next_val;
END;
$$;

-- Adicionando restrição UNIQUE ao user_number se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_number_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_number_key UNIQUE (user_number);
    END IF;
END $$;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_number ON public.profiles(user_number);

-- Função para log de auditoria automático na criação de usuário (trigger)
CREATE OR REPLACE FUNCTION public.on_profile_created_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (
    NEW.user_id,
    'user_created',
    jsonb_build_object(
      'name', NEW.name,
      'email', NEW.email,
      'user_number', NEW.user_number,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger com DROP prévio para evitar erro se já existir
DROP TRIGGER IF EXISTS trg_profile_created_audit ON public.profiles;
CREATE TRIGGER trg_profile_created_audit
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.on_profile_created_audit();

-- Garantindo permissões
GRANT EXECUTE ON FUNCTION public.get_next_user_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_user_number() TO service_role;

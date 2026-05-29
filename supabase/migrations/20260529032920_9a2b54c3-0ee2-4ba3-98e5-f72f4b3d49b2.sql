CREATE OR REPLACE FUNCTION public.get_next_user_number()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(MAX(user_number), 0) + 1 FROM public.profiles;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_user_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_user_number() TO service_role;
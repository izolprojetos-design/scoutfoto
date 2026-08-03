CREATE OR REPLACE FUNCTION public.search_users_for_scheduling(p_query text)
RETURNS TABLE(
  user_id uuid,
  name text,
  email text,
  section text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_query := lower(trim(coalesce(p_query, '')));

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.user_id, p.name, p.email, p.section
    FROM public.profiles p
    WHERE p.is_active = true
      AND p.user_id <> auth.uid()
      AND (
        lower(p.name) LIKE '%' || v_query || '%'
        OR lower(p.email) LIKE v_query || '%'
      )
    ORDER BY
      CASE WHEN lower(p.name) LIKE v_query || '%' THEN 0 ELSE 1 END,
      p.name
    LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users_for_scheduling(text) TO authenticated;
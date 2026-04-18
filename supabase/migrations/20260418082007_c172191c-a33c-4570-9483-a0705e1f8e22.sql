CREATE OR REPLACE FUNCTION public.admin_list_online_users()
RETURNS TABLE(user_id uuid, name text, last_active timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT 
    s.user_id,
    COALESCE(p.name, 'Desconhecido') AS name,
    MAX(s.updated_at) AS last_active
  FROM auth.sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE s.updated_at > now() - interval '30 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM auth.refresh_tokens rt
      WHERE rt.session_id = s.id AND rt.revoked = true
    )
  GROUP BY s.user_id, p.name
  ORDER BY last_active DESC;
END;
$$;
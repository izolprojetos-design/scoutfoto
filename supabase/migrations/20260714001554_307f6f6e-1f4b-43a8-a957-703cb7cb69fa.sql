
CREATE OR REPLACE FUNCTION public.get_db_storage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_db bigint;
  v_tables jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  SELECT pg_database_size(current_database()) INTO v_db;

  SELECT jsonb_agg(t ORDER BY (t->>'bytes')::bigint DESC)
  INTO v_tables
  FROM (
    SELECT jsonb_build_object(
      'table', relname,
      'bytes', pg_total_relation_size(relid),
      'rows', COALESCE(n_live_tup, 0)
    ) AS t
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 20
  ) sub;

  RETURN jsonb_build_object('db_bytes', v_db, 'tables', COALESCE(v_tables, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.get_db_storage_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_db_storage_stats() TO authenticated;

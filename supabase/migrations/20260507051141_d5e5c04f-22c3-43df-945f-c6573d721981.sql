REVOKE EXECUTE ON FUNCTION public.respond_agendamento(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_agendamento(uuid, text, text) TO authenticated;
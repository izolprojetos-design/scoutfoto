
-- Helpers internos chamados em RLS: precisam de EXECUTE p/ authenticated nas policies.
-- Mantém. Mas explicitamente revoga de anon.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_event_permission(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_section(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_storage_image(uuid, text) FROM anon;

-- Internas (não chamadas direto pelo cliente)
REVOKE EXECUTE ON FUNCTION public.clear_login_attempts(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_login_block(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_login_failure(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_share_link_view(text) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_invite_link_by_token(text) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_share_link_by_token(text) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.requeue_notification(text, uuid) FROM PUBLIC, anon;

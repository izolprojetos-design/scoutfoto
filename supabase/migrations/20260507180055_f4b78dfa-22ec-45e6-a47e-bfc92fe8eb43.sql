
-- Allow anonymous visitors to validate share tokens
GRANT EXECUTE ON FUNCTION public.get_share_link_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_share_link_view(text) TO anon, authenticated;

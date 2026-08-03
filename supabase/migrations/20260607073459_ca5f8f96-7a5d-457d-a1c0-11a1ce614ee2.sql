ALTER TABLE public.scouts ADD COLUMN admission_date DATE;
COMMENT ON COLUMN public.scouts.admission_date IS 'Data de ingresso do integrante no grupo escoteiro.';
GRANT ALL ON public.scouts TO authenticated;
GRANT ALL ON public.scouts TO service_role;

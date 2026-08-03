
CREATE INDEX IF NOT EXISTS idx_events_event_date_desc ON public.events (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_scouts_name ON public.scouts (name);
CREATE INDEX IF NOT EXISTS idx_scouts_is_active_name ON public.scouts (is_active, name);

ALTER TABLE public.events ADD COLUMN source text NOT NULL DEFAULT 'manual';

CREATE INDEX idx_events_source ON public.events (source);
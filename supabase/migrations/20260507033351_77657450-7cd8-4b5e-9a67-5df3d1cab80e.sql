ALTER TABLE public.scout_photos
ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scout_photos_scout_created
  ON public.scout_photos (scout_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scout_photos_favorite
  ON public.scout_photos (scout_id, is_favorite) WHERE is_favorite = true;
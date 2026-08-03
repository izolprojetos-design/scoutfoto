-- Add media_type column to images table
ALTER TABLE public.images
ADD COLUMN media_type text NOT NULL DEFAULT 'image'
CONSTRAINT images_media_type_check CHECK (media_type IN ('image', 'video'));

-- Add duration_seconds for video metadata
ALTER TABLE public.images
ADD COLUMN duration_seconds numeric NULL;
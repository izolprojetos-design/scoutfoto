UPDATE public.scouts
SET photo_url = substring(photo_url FROM '/object/(?:public|sign)/scout-photos/([^?]+)')
WHERE photo_url LIKE 'http%/scout-photos/%';
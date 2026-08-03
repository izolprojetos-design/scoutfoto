-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos-agendamentos', 'anexos-agendamentos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Owner can upload scheduling attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'anexos-agendamentos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owner can read own scheduling attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'anexos-agendamentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Owner can delete own scheduling attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'anexos-agendamentos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create attachments table
CREATE TABLE public.scheduling_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id uuid NOT NULL REFERENCES public.scheduling_requests(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  content_type text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduling_attachments ENABLE ROW LEVEL SECURITY;

-- Owner can view own attachments (via scheduling_requests ownership)
CREATE POLICY "Owner can view own attachments"
ON public.scheduling_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scheduling_requests sr
    WHERE sr.id = scheduling_request_id AND sr.user_id = auth.uid()
  )
);

-- Admin can view all attachments
CREATE POLICY "Admin can view all attachments"
ON public.scheduling_attachments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Owner can insert attachments for own pending requests
CREATE POLICY "Owner can insert attachments"
ON public.scheduling_attachments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.scheduling_requests sr
    WHERE sr.id = scheduling_request_id
      AND sr.user_id = auth.uid()
      AND sr.status IN ('pendente', 'confirmado_email')
  )
);

-- Owner can delete attachments for own pending requests
CREATE POLICY "Owner can delete own attachments"
ON public.scheduling_attachments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scheduling_requests sr
    WHERE sr.id = scheduling_request_id
      AND sr.user_id = auth.uid()
      AND sr.status IN ('pendente', 'confirmado_email')
  )
);
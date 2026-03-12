
-- Create event_permissions table for per-event access control
CREATE TABLE public.event_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_upload BOOLEAN NOT NULL DEFAULT false,
  can_download BOOLEAN NOT NULL DEFAULT false,
  can_manage BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_permissions ENABLE ROW LEVEL SECURITY;

-- Admins, chefes, dirigentes can manage event permissions
CREATE POLICY "Admins chefes dirigentes can manage event_permissions"
ON public.event_permissions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'chefe'::app_role)
  OR has_role(auth.uid(), 'dirigente'::app_role)
);

-- Authenticated users can view their own event permissions
CREATE POLICY "Users can view own event_permissions"
ON public.event_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add more action types to audit_logs for better tracking
-- (table already exists, just adding an index for performance)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_event_permissions_event_id ON public.event_permissions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_permissions_user_id ON public.event_permissions(user_id);

-- Create a function to check event-level permission
CREATE OR REPLACE FUNCTION public.has_event_permission(_user_id uuid, _event_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_permissions
    WHERE user_id = _user_id
      AND event_id = _event_id
      AND (
        (_permission = 'view' AND can_view = true)
        OR (_permission = 'upload' AND can_upload = true)
        OR (_permission = 'download' AND can_download = true)
        OR (_permission = 'manage' AND can_manage = true)
      )
  )
$$;


-- ETAPA 5: Fix security findings + Enhanced audit logging

-- 1. Fix guardians SELECT: restrict to roles with leadership access
DROP POLICY IF EXISTS "Permission-based view guardians" ON public.guardians;
CREATE POLICY "Permission-based view guardians" ON public.guardians
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'chefe'::app_role)
    OR has_role(auth.uid(), 'dirigente'::app_role)
    OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
    OR has_permission(auth.uid(), 'view_guardians'::text)
  );

-- 2. Fix event_share_links: drop overly permissive anon UPDATE policy
DROP POLICY IF EXISTS "Anon can increment view count" ON public.event_share_links;
-- increment_share_link_view RPC (SECURITY DEFINER) already handles this securely

-- 3. Fix profiles SELECT: restrict sensitive fields to own profile + admin + managers
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
-- Keep existing policies: own profile, admin, manage_events/manage_users permission holders

-- 4. Add indexes on audit_logs for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);

-- 5. Make audit_logs immutable: deny UPDATE and DELETE with explicit deny policies
-- (Already no UPDATE/DELETE policies exist, which means they're denied by default with RLS enabled)

-- 6. Add ip_address and before_data/after_data columns to audit_logs for enhanced auditing
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS before_data jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS after_data jsonb;

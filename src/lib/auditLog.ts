import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 'upload' | 'view' | 'download' | 'edit' | 'delete' | 'login' | 'login_failed' | 'password_changed' | 'password_reset' | 'account_locked';

export const logAudit = async (
  userId: string,
  action: AuditAction,
  imageId?: string,
  details?: Record<string, unknown>
) => {
  await supabase.from('audit_logs').insert([{
    user_id: userId,
    action,
    image_id: imageId || null,
    details: (details || {}) as any,
  }]);
};

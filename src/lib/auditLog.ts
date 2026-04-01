import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 
  | 'upload' | 'view' | 'download' | 'edit' | 'delete' 
  | 'login' | 'login_failed' | 'logout'
  | 'password_changed' | 'password_reset' | 'account_locked' 
  | 'logout_all_sessions' | 'remote_device_removed' | 'session_revoked_password_change'
  | 'create_event' | 'change_permissions' | 'create_user'
  | 'data_update' | 'access_denied' | 'mfa_enabled' | 'mfa_disabled'
  | 'role_change' | 'status_change' | 'section_change';

export const logAudit = async (
  userId: string,
  action: AuditAction,
  imageId?: string,
  details?: Record<string, unknown>,
  beforeData?: Record<string, unknown>,
  afterData?: Record<string, unknown>
) => {
  await supabase.from('audit_logs').insert([{
    user_id: userId,
    action,
    image_id: imageId || null,
    details: (details || {}) as any,
    before_data: (beforeData || null) as any,
    after_data: (afterData || null) as any,
  }]);
};

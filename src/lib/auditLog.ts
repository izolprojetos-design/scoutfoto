import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 
  | 'upload' | 'view' | 'download' | 'edit' | 'delete' | 'add_external_link' | 'edit_external_link' | 'delete_external_link' 
  | 'login' | 'login_failed' | 'logout'
  | 'password_changed' | 'password_reset' | 'account_locked' 
  | 'logout_all_sessions' | 'remote_device_removed' | 'session_revoked_password_change'
  | 'create_event' | 'change_permissions' | 'create_user'
  | 'data_update' | 'access_denied' | 'mfa_enabled' | 'mfa_disabled'
  | 'role_change' | 'status_change' | 'section_change' | 'force_remote_refresh'
  | 'scheduling_approve' | 'scheduling_reject'
  | 'camera_access_denied' | 'camera_unavailable';

export const logAudit = async (
  _userId: string,
  action: AuditAction,
  imageId?: string,
  details?: Record<string, unknown>,
  beforeData?: Record<string, unknown>,
  afterData?: Record<string, unknown>
) => {
  await supabase.rpc('log_audit', {
    _action: action,
    _image_id: imageId || null,
    _details: (details || {}) as any,
    _before_data: (beforeData || null) as any,
    _after_data: (afterData || null) as any,
  });
};

import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 'upload' | 'view' | 'download' | 'edit' | 'delete';

export const logAudit = async (
  userId: string,
  action: AuditAction,
  imageId?: string,
  details?: Record<string, unknown>
) => {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    image_id: imageId || null,
    details: details || {},
  });
};

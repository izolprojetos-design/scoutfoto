import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from './usePermissions';

export interface EventPermission {
  can_view: boolean;
  can_upload: boolean;
  can_download: boolean;
  can_manage: boolean;
}

/**
 * Hook to check event-specific permissions.
 * Priority: event_permissions > role_permissions (profile)
 * If no event-specific permission exists, falls back to role-based permissions.
 */
export const useEventPermissions = (eventId?: string) => {
  const { user, isAdmin } = useAuth();
  const { canViewPhotos, canUploadPhotos, canDownloadPhotos, canManageEvents } = usePermissions();
  const [eventPerm, setEventPerm] = useState<EventPermission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !user) {
      setEventPerm(null);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from('event_permissions')
        .select('can_view, can_upload, can_download, can_manage')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      setEventPerm(data || null);
      setLoading(false);
    };

    fetch();
  }, [eventId, user]);

  // Admin always has full access
  if (isAdmin) {
    return {
      loading: false,
      canView: true,
      canUpload: true,
      canDownload: true,
      canManage: true,
      hasEventOverride: false,
    };
  }

  // If event-specific permission exists, use it (overrides profile)
  if (eventPerm) {
    return {
      loading,
      canView: eventPerm.can_view,
      canUpload: eventPerm.can_upload,
      canDownload: eventPerm.can_download,
      canManage: eventPerm.can_manage,
      hasEventOverride: true,
    };
  }

  // Fallback to role-based permissions
  return {
    loading,
    canView: canViewPhotos,
    canUpload: canUploadPhotos,
    canDownload: canDownloadPhotos,
    canManage: canManageEvents,
    hasEventOverride: false,
  };
};

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PermissionKey =
  | 'view_photos'
  | 'upload_photos'
  | 'download_photos'
  | 'edit_photos'
  | 'delete_photos'
  | 'manage_photos'
  | 'view_events'
  | 'edit_events'
  | 'view_event_photos'
  | 'download_event_photos'
  | 'edit_event_photos'
  | 'upload_event_photos'
  | 'delete_event_photos'
  | 'manage_events'
  | 'manage_scouts'
  | 'edit_scouts'
  | 'view_scouts'
  | 'view_guardians'
  | 'manage_users'
  | 'view_users'
  | 'edit_users'
  | 'delete_data'
  | 'access_admin'
  | 'transfer_branch';

export interface Permission {
  id: string;
  key: string;
  name: string;
  category: string;
  sort_order: number;
}

export const usePermissions = () => {
  const { user, roles } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || roles.length === 0) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      // Admins have all permissions
      if (roles.includes('admin')) {
        const { data: allPerms } = await supabase
          .from('permissions')
          .select('key');
        if (allPerms) {
          setPermissions(allPerms.map((p: any) => p.key));
        }
        setLoading(false);
        return;
      }

      // Fetch individual user permissions
      const { data } = await supabase
        .from('user_permissions')
        .select('permission_id, permissions(key)')
        .eq('user_id', user.id);

      if (data) {
        const keys = data
          .map((up: any) => up.permissions?.key)
          .filter(Boolean) as string[];
        setPermissions([...new Set(keys)]);
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [user, roles]);

  const hasPermission = (key: PermissionKey) => permissions.includes(key);

  return {
    permissions,
    loading,
    hasPermission,
    // Fotos
    canViewPhotos: hasPermission('view_photos'),
    canUploadPhotos: hasPermission('upload_photos'),
    canDownloadPhotos: hasPermission('download_photos'),
    canEditPhotos: hasPermission('edit_photos'),
    canDeletePhotos: hasPermission('delete_photos'),
    canManagePhotos: hasPermission('manage_photos'),
    // Eventos
    canViewEvents: hasPermission('view_events'),
    canEditEvents: hasPermission('edit_events'),
    canManageEvents: hasPermission('manage_events'),
    canViewEventPhotos: hasPermission('view_event_photos'),
    canDownloadEventPhotos: hasPermission('download_event_photos'),
    canEditEventPhotos: hasPermission('edit_event_photos'),
    canUploadEventPhotos: hasPermission('upload_event_photos'),
    canDeleteEventPhotos: hasPermission('delete_event_photos'),
    // Integrantes
    canViewScouts: hasPermission('view_scouts'),
    canEditScouts: hasPermission('edit_scouts'),
    canManageScouts: hasPermission('manage_scouts'),
    canViewGuardians: hasPermission('view_guardians'),
    canTransferBranch: hasPermission('transfer_branch'),
    // Administração
    canManageUsers: hasPermission('manage_users'),
    canViewUsers: hasPermission('view_users'),
    canEditUsers: hasPermission('edit_users'),
    canDeleteData: hasPermission('delete_data'),
    canAccessAdmin: hasPermission('access_admin'),
  };
};

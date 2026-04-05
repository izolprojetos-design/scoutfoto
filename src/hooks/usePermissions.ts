import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PermissionKey =
  | 'view_photos'
  | 'upload_photos'
  | 'download_photos'
  | 'edit_photos'
  | 'delete_photos'
  | 'view_events'
  | 'edit_events'
  | 'view_event_photos'
  | 'download_event_photos'
  | 'manage_events'
  | 'manage_scouts'
  | 'manage_users'
  | 'view_guardians'
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
    canViewPhotos: hasPermission('view_photos'),
    canUploadPhotos: hasPermission('upload_photos'),
    canDownloadPhotos: hasPermission('download_photos'),
    canViewEvents: hasPermission('view_events'),
    canEditEvents: hasPermission('edit_events'),
    canManageEvents: hasPermission('manage_events'),
    canManageScouts: hasPermission('manage_scouts'),
    canManageUsers: hasPermission('manage_users'),
  };
};

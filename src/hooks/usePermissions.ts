import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PermissionKey =
  | 'view_photos'
  | 'upload_photos'
  | 'download_photos'
  | 'manage_events'
  | 'manage_scouts'
  | 'manage_users'
  | 'view_guardians';

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
      // Fetch permissions for the user's role(s)
      const { data } = await supabase
        .from('role_permissions')
        .select('permission_id, permissions(key)')
        .in('role', roles);

      if (data) {
        const keys = data
          .map((rp: any) => rp.permissions?.key)
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
    canManageEvents: hasPermission('manage_events'),
    canManageScouts: hasPermission('manage_scouts'),
    canManageUsers: hasPermission('manage_users'),
  };
};

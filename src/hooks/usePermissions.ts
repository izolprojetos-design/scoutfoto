import { useEffect, useState, useRef, useMemo } from 'react';
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
  | 'transfer_branch'
  | 'google_drive_links'
  | 'google_drive_images'
  | 'google_drive_videos'
  | 'google_drive_documents';

export interface Permission {
  id: string;
  key: string;
  name: string;
  category: string;
  sort_order: number;
}

// Cache permissions per user to avoid re-fetching on every route change
const permissionsCache = new Map<string, { permissions: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const usePermissions = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef<string | null>(null);
  const rolesRef = useRef<string>("");

  const currentRolesKey = useMemo(() => [...roles].sort().join(','), [roles]);

  useEffect(() => {
    // Se o Auth ainda está carregando, mantemos o loading de permissões
    if (authLoading) {
      setLoading(true);
      return;
    }

    // Se não há usuário logado, não há o que carregar
    if (!user) {
      setPermissions([]);
      setLoading(false);
      fetchedRef.current = null;
      rolesRef.current = "";
      return;
    }

    // Evita re-fetch se já carregamos para este usuário com estes mesmos papéis
    if (fetchedRef.current === user.id && rolesRef.current === currentRolesKey) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      setLoading(true);
      try {
        console.log(`[usePermissions] Carregando permissões para ${user.id} (${currentRolesKey})`);
        
        // Admins têm todas as permissões
        if (roles.includes('admin')) {
          const { data: allPerms } = await supabase
            .from('permissions')
            .select('key');
          if (allPerms) {
            const keys = allPerms.map((p: any) => p.key);
            setPermissions(keys);
          }
        } else {
          // Busca permissões individuais e por papel
          const [userPermsRes, rolePermsRes] = await Promise.all([
            supabase
              .from('user_permissions')
              .select('permission_id, permissions(key)')
              .eq('user_id', user.id),
            supabase
              .from('role_permissions')
              .select('permission_id, permissions(key)')
              .in('role', roles)
          ]);

          const userPermKeys = (userPermsRes.data || [])
            .map((up: any) => up.permissions?.key)
            .filter(Boolean) as string[];

          const rolePermKeys = (rolePermsRes.data || [])
            .map((rp: any) => rp.permissions?.key)
            .filter(Boolean) as string[];

          setPermissions([...new Set([...userPermKeys, ...rolePermKeys])]);
        }
        
        fetchedRef.current = user.id;
        rolesRef.current = currentRolesKey;
      } catch (err) {
        console.error('[usePermissions] Erro ao carregar:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
    // `roles` intentionally omitted — currentRolesKey covers real changes and
    // avoids re-firing on every AuthContext render (roles is a new array ref each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentRolesKey, authLoading]);

  const hasPermission = (key: PermissionKey) => {
    if (roles.includes('admin')) return true;
    return permissions.includes(key);
  };

  return {
    permissions,
    loading,
    hasPermission,
    // Fotos
    canViewPhotos: hasPermission('view_photos') || roles.includes('admin') || roles.includes('voluntario') || roles.includes('dirigente_gestor') || roles.includes('chefe') || roles.includes('dirigente') || roles.includes('viewer'),
    canUploadPhotos: hasPermission('upload_photos'),
    canDownloadPhotos: hasPermission('download_photos'),
    canEditPhotos: hasPermission('edit_photos'),
    canDeletePhotos: hasPermission('delete_photos'),
    canManagePhotos: hasPermission('manage_photos'),
    // Eventos
    canViewEvents: hasPermission('view_events') || roles.includes('admin') || roles.includes('voluntario') || roles.includes('dirigente_gestor') || roles.includes('chefe') || roles.includes('dirigente') || roles.includes('viewer'),
    canEditEvents: hasPermission('edit_events'),
    canManageEvents: hasPermission('manage_events'),
    canViewEventPhotos: hasPermission('view_event_photos'),
    canDownloadEventPhotos: hasPermission('download_event_photos'),
    canEditEventPhotos: hasPermission('edit_event_photos'),
    canUploadEventPhotos: hasPermission('upload_event_photos'),
    canDeleteEventPhotos: hasPermission('delete_event_photos'),
    // Integrantes
    canViewScouts: hasPermission('view_scouts') || roles.includes('admin') || roles.includes('voluntario') || roles.includes('dirigente_gestor') || roles.includes('chefe') || roles.includes('dirigente') || roles.includes('parent') || roles.includes('viewer'),
    canEditScouts: hasPermission('edit_scouts') || roles.includes('admin') || roles.includes('voluntario'),
    canManageScouts: hasPermission('manage_scouts') || roles.includes('admin') || roles.includes('voluntario'),
    canViewGuardians: hasPermission('view_guardians') || roles.includes('admin') || roles.includes('voluntario'),
    canTransferBranch: hasPermission('transfer_branch') || roles.includes('admin') || roles.includes('voluntario'),
    // Administração
    canManageUsers: hasPermission('manage_users'),
    canViewUsers: hasPermission('view_users'),
    canEditUsers: hasPermission('edit_users'),
    canDeleteData: hasPermission('delete_data'),
    canAccessAdmin: hasPermission('access_admin'),
    canManageGoogleDrive: hasPermission('google_drive_links'),
    canAddDriveImages: hasPermission('google_drive_images'),
    canAddDriveVideos: hasPermission('google_drive_videos'),
    canAddDriveDocuments: hasPermission('google_drive_documents'),
  };
};

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STORAGE_KEY = 'scoutfoto_last_force_refresh_at';
const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

const clearCachesAndReload = async () => {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    localStorage.removeItem('scoutfoto_app_version');
  } catch {
    // ignore
  }
  window.location.reload();
};

/**
 * Periodically checks if an admin requested a forced refresh of this user's PWA.
 * Reads `force_refresh_at` from the user's profile; when it changes, clears caches and reloads.
 */
export const useRemoteForceRefresh = (userId: string | null | undefined) => {
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('force_refresh_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled || error || !data?.force_refresh_at) return;

      const remoteTs = data.force_refresh_at;
      const lastSeen = localStorage.getItem(STORAGE_KEY);

      if (!lastSeen) {
        // First time we see a value — record it without reloading
        localStorage.setItem(STORAGE_KEY, remoteTs);
        return;
      }

      if (lastSeen !== remoteTs) {
        localStorage.setItem(STORAGE_KEY, remoteTs);
        toast.info('Atualização do app solicitada pelo administrador. Recarregando...', {
          duration: 4000,
        });
        setTimeout(() => {
          clearCachesAndReload();
        }, 1500);
      }
    };

    // Run immediately, then on interval
    void check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);
};

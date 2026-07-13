import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STORAGE_KEY = 'scoutfoto_last_force_refresh_at';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (realtime subscription handles instant updates)

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

    const handleRemoteTimestamp = (remoteTs: string | null | undefined) => {
      if (cancelled || !remoteTs) return;

      const lastSeen = localStorage.getItem(STORAGE_KEY);

      if (!lastSeen) {
        // First time we see a value — record it without reloading
        localStorage.setItem(STORAGE_KEY, remoteTs);
        return;
      }

      if (lastSeen !== remoteTs) {
        localStorage.setItem(STORAGE_KEY, remoteTs);
        toast.info('Suas permissões foram atualizadas. Recarregando...', {
          duration: 3000,
        });
        setTimeout(() => {
          clearCachesAndReload();
        }, 1200);
      }
    };

    const check = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('force_refresh_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled || error) return;
      handleRemoteTimestamp(data?.force_refresh_at);
    };

    // Run immediately, then on interval as fallback
    void check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    // Realtime: react instantly when admin updates force_refresh_at
    const channel = supabase
      .channel(`force-refresh-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new as { force_refresh_at?: string | null })?.force_refresh_at;
          handleRemoteTimestamp(next);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId]);
};

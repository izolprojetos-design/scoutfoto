import { useEffect } from 'react';
import { toast } from 'sonner';

const APP_VERSION_KEY = 'scoutfoto_app_version';

const forceReload = async () => {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // ignore cache errors
  }
  window.location.reload();
};

/**
 * Checks for app updates by comparing a build timestamp.
 * Forces a hard reload when a new version is detected.
 */
export const useAppUpdate = () => {
  useEffect(() => {
    const currentVersion = import.meta.env.VITE_BUILD_TIME || '__dev__';
    const savedVersion = localStorage.getItem(APP_VERSION_KEY);

    if (savedVersion && savedVersion !== currentVersion && currentVersion !== '__dev__') {
      localStorage.setItem(APP_VERSION_KEY, currentVersion);
      // Clear all caches and force reload
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      window.location.reload();
      return;
    }

    if (!savedVersion || savedVersion !== currentVersion) {
      localStorage.setItem(APP_VERSION_KEY, currentVersion);
    }
  }, []);
};

/**
 * Periodically checks for updates while the app is open.
 * Useful for long-lived PWA sessions.
 */
export const usePeriodicUpdateCheck = (intervalMs = 5 * 60 * 1000) => {
  useEffect(() => {
    let notified = false;

    const showUpdateToast = () => {
      if (notified) return;
      notified = true;
      toast.info('Nova versão disponível', {
        id: 'app-update-available',
        description: 'Atualize para garantir os recursos mais recentes.',
        duration: 8000,
        action: {
          label: 'Atualizar agora',
          onClick: () => forceReload(),
        },
      });
    };

    const onUpdateEvent = () => showUpdateToast();
    window.addEventListener('app-update-available', onUpdateEvent);

    // Manual trigger for testing: visit any page with ?test-update=1
    (window as any).__testUpdateToast = showUpdateToast;
    if (new URLSearchParams(window.location.search).get('test-update') === '1') {
      setTimeout(showUpdateToast, 500);
    }

    const check = async () => {
      try {
        // Fetch index.html with cache-busting to detect new deployments
        const res = await fetch('/?_t=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const html = await res.text();
          const currentScript = document.querySelector('script[type="module"][src^="/src/"], script[type="module"][src^="/assets/"]');
          // If the main script src changed, a new version is available
          if (currentScript && !html.includes(currentScript.getAttribute('src') || '')) {
            const event = new CustomEvent('app-update-available');
            window.dispatchEvent(event);
          }
        }
      } catch {
        // Network error - ignore
      }
    };

    const interval = setInterval(check, intervalMs);
    return () => {
      clearInterval(interval);
      window.removeEventListener('app-update-available', onUpdateEvent);
    };
  }, [intervalMs]);
};

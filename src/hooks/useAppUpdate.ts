import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

const APP_VERSION_KEY = 'scoutfoto_app_version';
const BUILD_VERSION = import.meta.env.VITE_BUILD_TIME || '__dev__';

/**
 * On mount, compares the current build timestamp against the one stored
 * in localStorage.  When a mismatch is found the entire Cache Storage is
 * purged and the page hard-reloads so the user always sees the latest
 * published version — no need to uninstall the PWA.
 */
export const useAppUpdate = () => {
  useEffect(() => {
    if (BUILD_VERSION === '__dev__') return; // skip in dev

    const saved = localStorage.getItem(APP_VERSION_KEY);

    if (saved && saved !== BUILD_VERSION) {
      // New version detected → clear caches and reload
      localStorage.setItem(APP_VERSION_KEY, BUILD_VERSION);

      const clearAndReload = async () => {
        // 1. Wipe Cache Storage (service-worker caches, etc.)
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        }

        // 2. Unregister any lingering service workers
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }

        // 3. Hard reload bypassing browser cache
        window.location.reload();
      };

      clearAndReload();
      return;
    }

    // First visit or same version → just persist
    if (!saved || saved !== BUILD_VERSION) {
      localStorage.setItem(APP_VERSION_KEY, BUILD_VERSION);
    }
  }, []);
};

/**
 * Every `intervalMs` milliseconds, fetches index.html with a cache-busting
 * query param and compares the embedded script hash against the currently
 * loaded one.  When a new deploy is detected it shows a toast and reloads
 * after a short delay so the user isn't surprised.
 */
export const usePeriodicUpdateCheck = (intervalMs = 5 * 60 * 1000) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      const res = await fetch(`/?_cache_bust=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
      });
      if (!res.ok) return;

      const html = await res.text();

      // Vite production builds use hashed file names in script tags, e.g.:
      //   <script type="module" src="/assets/index-abc123.js">
      // In dev mode the src is "/src/main.tsx".
      // We compare the src of the main script tag.
      const remoteMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
      const localScript = document.querySelector('script[type="module"][src]');

      if (remoteMatch && localScript) {
        const remoteSrc = remoteMatch[1];
        const localSrc = localScript.getAttribute('src') || '';

        if (remoteSrc !== localSrc) {
          setUpdateAvailable(true);
        }
      }
    } catch {
      // Network error — silently ignore
    }
  }, []);

  // Run the check on an interval
  useEffect(() => {
    // Initial check after a short delay (don't block startup)
    const initialTimer = setTimeout(checkForUpdate, 30_000);
    const interval = setInterval(checkForUpdate, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkForUpdate, intervalMs]);

  // When an update is detected, show a toast and auto-reload
  useEffect(() => {
    if (!updateAvailable) return;

    const toastId = toast.info('Nova versão disponível! Atualizando...', {
      duration: 4000,
      id: 'app-update',
    });

    const timer = setTimeout(async () => {
      // Clear caches before reload
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      localStorage.setItem(APP_VERSION_KEY, '__force_update__');
      window.location.reload();
    }, 3000);

    return () => {
      clearTimeout(timer);
      toast.dismiss(toastId);
    };
  }, [updateAvailable]);
};

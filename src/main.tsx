import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { getReloadMessages } from "./lib/i18n/reloadMessages";

// Auto-recover from stale dynamic-import chunks after deploys.
// When a lazy()-loaded module fails to fetch (old hash no longer on server),
// clear caches and hard-reload — but only once per session to avoid loops.
const RELOAD_KEY = "scoutfoto_chunk_reload_at";
const RELOAD_FLAG = "scoutfoto_chunk_reload_pending";

const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module/i.test(msg) ||
  /Importing a module script failed/i.test(msg) ||
  /ChunkLoadError/i.test(msg) ||
  /Loading chunk \d+ failed/i.test(msg);

const hardReload = async () => {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // ignore
  }
  window.location.reload();
};

const showManualReloadToast = () => {
  const t = getReloadMessages();
  toast.error(t.failureTitle, {
    id: "chunk-load-failed",
    description: t.failureDescription,
    duration: Infinity,
    action: {
      label: t.reloadAction,
      onClick: () => {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        void hardReload();
      },
    },
  });
};

const recoverFromStaleChunk = async () => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  // Avoid reload loops: if we already auto-reloaded recently, show a manual fallback
  if (Date.now() - last < 30_000) {
    showManualReloadToast();
    return;
  }
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  sessionStorage.setItem(RELOAD_FLAG, "1");
  await hardReload();
};

window.addEventListener("error", (e) => {
  if (e?.message && isChunkLoadError(e.message)) recoverFromStaleChunk();
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e?.reason as any)?.message ?? e?.reason ?? "");
  if (isChunkLoadError(msg)) recoverFromStaleChunk();
});

// After an auto-recovery reload, inform the user it was due to a new version.
if (sessionStorage.getItem(RELOAD_FLAG) === "1") {
  sessionStorage.removeItem(RELOAD_FLAG);
  // Defer until after Toaster mounts
  setTimeout(() => {
    const t = getReloadMessages();
    toast.success(t.successTitle, {
      id: "chunk-reload-success",
      description: t.successDescription,
      duration: 5000,
    });
  }, 800);
}

// ──────────────────────────────────────────────────────────────────────────────
// Service Worker registration with always-fresh update strategy.
// - updateViaCache: "none" → the SW script itself is never cached by the browser
// - On `updatefound`, when the new worker reaches `installed`, we ask it to
//   skipWaiting and dispatch `app-update-available` so the toast can prompt
//   a reload (handled by usePeriodicUpdateCheck).
// - When a new SW activates and takes control, we hard-reload the page so it
//   runs against the latest assets — but only once, to avoid loops.
// - Guards: never register inside the Lovable preview iframe; instead actively
//   unregister any leftover SW so the editor preview is always live.
// ──────────────────────────────────────────────────────────────────────────────
(function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (inIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    }).catch(() => {});
    return;
  }

  const RELOAD_AFTER_ACTIVATE = "scoutfoto_sw_reloaded_at";

  const dispatchUpdateAvailable = () => {
    try { window.dispatchEvent(new CustomEvent("app-update-available")); } catch {}
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // A new SW just took control. Reload once to ensure JS/CSS match it.
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_AFTER_ACTIVATE) || 0); } catch {}
    if (Date.now() - last < 30_000) return; // loop guard
    try { sessionStorage.setItem(RELOAD_AFTER_ACTIVATE, String(Date.now())); } catch {}
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw-push.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        // If a worker is already waiting at registration time, tell it to activate.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          dispatchUpdateAvailable();
        }

        registration.addEventListener("updatefound", () => {
          const next = registration.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              // New version available alongside an existing controller → upgrade now.
              next.postMessage({ type: "SKIP_WAITING" });
              dispatchUpdateAvailable();
            }
          });
        });

        // Periodic update check (covers long-lived PWA sessions where `load`
        // fires only once). Every 15 min and on visibility change.
        const checkForUpdate = () => { registration.update().catch(() => {}); };
        setInterval(checkForUpdate, 15 * 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[sw] registration failed", err);
      });
  });
})();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);


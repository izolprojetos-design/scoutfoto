import { lazy, ComponentType } from "react";

const RELOAD_KEY = "__chunk_retry_reloaded__";

/**
 * Lazy import with retry + auto-reload fallback for stale chunks.
 * Detects "Failed to fetch dynamically imported module" errors (typical
 * after a deploy or dev-server restart) and retries with cache-busting,
 * then forces a one-time hard reload as last resort.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 400,
) {
  return lazy(async () => {
    let lastError: unknown;
    for (let i = 0; i <= retries; i++) {
      try {
        const mod = await factory();
        // success — clear reload guard for next failure cycle
        try { sessionStorage.removeItem(RELOAD_KEY); } catch {}
        return mod;
      } catch (err) {
        lastError = err;
        const msg = String((err as Error)?.message || err);
        const isChunkError =
          msg.includes("Failed to fetch dynamically imported module") ||
          msg.includes("Importing a module script failed") ||
          msg.includes("error loading dynamically imported module");
        if (!isChunkError) throw err;
        if (i < retries) {
          await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
          continue;
        }
        // Final attempt: hard reload once to bust caches
        try {
          if (typeof window !== "undefined" && !sessionStorage.getItem(RELOAD_KEY)) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            window.location.reload();
            // Return a stub while reload happens
            return { default: (() => null) as unknown as T };
          }
        } catch {}
      }
    }
    throw lastError;
  });
}

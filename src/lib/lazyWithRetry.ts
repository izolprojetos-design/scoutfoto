import { lazy, ComponentType } from "react";

const RELOAD_KEY = "__chunk_retry_reloaded__";

export const CHUNK_TELEMETRY_ENDPOINT = "/api/telemetry/chunk-error";

export interface ChunkErrorReport {
  type: "ChunkLoadError";
  message: string;
  route: string;
  retries: number;
  willReload: boolean;
  timestamp: string;
  userAgent?: string;
}

export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err);
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("ChunkLoadError")
  );
}

export function reportChunkError(report: ChunkErrorReport) {
  // eslint-disable-next-line no-console
  console.error("[ChunkLoadError]", report);
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(report)], { type: "application/json" });
      navigator.sendBeacon(CHUNK_TELEMETRY_ENDPOINT, blob);
    } else if (typeof fetch !== "undefined") {
      fetch(CHUNK_TELEMETRY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* telemetry must never throw */
  }
}

/**
 * Lazy import with retry + auto-reload fallback for stale chunks.
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
        try { sessionStorage.removeItem(RELOAD_KEY); } catch {}
        return mod;
      } catch (err) {
        lastError = err;
        if (!isChunkLoadError(err)) throw err;
        if (i < retries) {
          await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
          continue;
        }
        const route = typeof window !== "undefined" ? window.location.pathname : "";
        let willReload = false;
        try {
          if (typeof window !== "undefined" && !sessionStorage.getItem(RELOAD_KEY)) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            willReload = true;
          }
        } catch {}

        reportChunkError({
          type: "ChunkLoadError",
          message: String((err as Error)?.message || err),
          route,
          retries: i,
          willReload,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        });

        if (willReload) {
          window.location.reload();
          return { default: (() => null) as unknown as T };
        }
      }
    }
    throw lastError;
  });
}

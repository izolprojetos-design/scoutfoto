// Client-side monitor for the Service Worker activation lifecycle.
// Goals:
//   1) Verify that cache cleanup on `activate` actually evicts old versions
//      (compare cachesBefore vs cachesAfter reported by the SW).
//   2) Watch for performance regressions around the activation:
//      - SW activate duration (reported by SW)
//      - Long Tasks (>= 50ms) immediately after activation
//      - LCP / navigation timing as a baseline
//
// All data is kept locally (last 20 events in localStorage) and surfaced via
// `console.info`. Inspect anytime with `window.__scoutfotoSwLog()`.

const STORAGE_KEY = "scoutfoto_sw_events";
const MAX_EVENTS = 20;
const POST_ACTIVATE_WATCH_MS = 5000; // window in which we count long tasks

export interface SwActivationEvent {
  type: "SW_ACTIVATED";
  version: string;
  timestamp: string;
  cachesBefore: string[];
  cachesDeleted: string[];
  cachesFailed: string[];
  cachesAfter: string[];
  durationMs: number;
}

interface StoredEvent extends SwActivationEvent {
  cleanupOk: boolean;
  postActivateLongTasks: number;
  postActivateLongestTaskMs: number;
  navStartMs?: number;
  lcpMs?: number;
}

const safeRead = (): StoredEvent[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredEvent[]) : [];
  } catch {
    return [];
  }
};

const safeWrite = (events: StoredEvent[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // quota exceeded → drop silently
  }
};

const measureLongTasks = (windowMs: number): Promise<{ count: number; longestMs: number }> =>
  new Promise((resolve) => {
    if (typeof PerformanceObserver === "undefined") {
      resolve({ count: 0, longestMs: 0 });
      return;
    }
    let count = 0;
    let longest = 0;
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          count += 1;
          if (entry.duration > longest) longest = entry.duration;
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      resolve({ count: 0, longestMs: 0 });
      return;
    }
    setTimeout(() => {
      try { observer?.disconnect(); } catch {}
      resolve({ count, longestMs: Math.round(longest) });
    }, windowMs);
  });

const getLcpMs = (): number | undefined => {
  try {
    const entries = performance.getEntriesByType("largest-contentful-paint");
    if (entries.length === 0) return undefined;
    const last = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
    return Math.round(last.renderTime || last.loadTime || last.startTime);
  } catch {
    return undefined;
  }
};

const getNavStartMs = (): number | undefined => {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav ? Math.round(nav.duration) : undefined;
  } catch {
    return undefined;
  }
};

let installed = false;

export function installSwMonitor() {
  if (installed) return;
  installed = true;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", async (event) => {
    const data = event.data as SwActivationEvent | undefined;
    if (!data || data.type !== "SW_ACTIVATED") return;

    const cleanupOk =
      data.cachesFailed.length === 0 &&
      data.cachesAfter.length === 0 &&
      data.cachesBefore.length === data.cachesDeleted.length;

    // Console summary — visible in DevTools, useful for QA on real devices.
    // eslint-disable-next-line no-console
    console.info(
      `%c[SW] ${data.version} activated in ${data.durationMs}ms`,
      "color:#14532d;font-weight:600",
      {
        cachesBefore: data.cachesBefore,
        cachesDeleted: data.cachesDeleted,
        cachesFailed: data.cachesFailed,
        cachesAfter: data.cachesAfter,
        cleanupOk,
      }
    );
    if (!cleanupOk) {
      // eslint-disable-next-line no-console
      console.warn("[SW] cache cleanup incomplete", {
        leftover: data.cachesAfter,
        failed: data.cachesFailed,
      });
    }

    // Watch for jank in the seconds after activation.
    const longTasks = await measureLongTasks(POST_ACTIVATE_WATCH_MS);
    const stored: StoredEvent = {
      ...data,
      cleanupOk,
      postActivateLongTasks: longTasks.count,
      postActivateLongestTaskMs: longTasks.longestMs,
      navStartMs: getNavStartMs(),
      lcpMs: getLcpMs(),
    };
    safeWrite([...safeRead(), stored]);

    if (longTasks.count > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[SW] post-activate window: ${longTasks.count} long task(s), longest ${longTasks.longestMs}ms`
      );
    }
  });

  // Inspector helper for the dev console.
  (window as unknown as { __scoutfotoSwLog: () => StoredEvent[] }).__scoutfotoSwLog = () => {
    const events = safeRead();
    // eslint-disable-next-line no-console
    console.table(
      events.map((e) => ({
        when: e.timestamp,
        version: e.version,
        durationMs: e.durationMs,
        cachesBefore: e.cachesBefore.length,
        deleted: e.cachesDeleted.length,
        failed: e.cachesFailed.length,
        leftover: e.cachesAfter.length,
        cleanupOk: e.cleanupOk,
        longTasksAfter: e.postActivateLongTasks,
        longestTaskMs: e.postActivateLongestTaskMs,
        lcpMs: e.lcpMs,
      }))
    );
    return events;
  };
}

export function getSwMonitorEvents(): StoredEvent[] {
  return safeRead();
}

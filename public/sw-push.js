// Service Worker for ScoutFoto
// Responsibilities:
//   1) Push notifications (showNotification + click handling)
//   2) Update lifecycle: skipWaiting + clients.claim so a new SW takes effect
//      immediately on the next page load — and on demand via SKIP_WAITING.
// IMPORTANT: This SW deliberately does NOT install a fetch handler. The app
// is served fresh from the network on every navigation; caching here would
// create stale-shell problems that override the latest deploy.

const SW_VERSION = "scoutfoto-sw-v3";

self.addEventListener("install", (event) => {
  // Take over as soon as installed; don't wait for old tabs to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Telemetry: capture cache state before/after + timing so the page can
      // confirm old versions were really evicted and watch for perf regressions.
      const t0 = (self.performance && self.performance.now) ? self.performance.now() : Date.now();
      let before = [];
      let deleted = [];
      let failed = [];
      try {
        before = await caches.keys();
        const results = await Promise.all(
          before.map((n) => caches.delete(n).then((ok) => ({ n, ok })).catch(() => ({ n, ok: false })))
        );
        deleted = results.filter((r) => r.ok).map((r) => r.n);
        failed = results.filter((r) => !r.ok).map((r) => r.n);
      } catch (e) {
        failed.push(String((e && e.message) || e));
      }
      let after = [];
      try { after = await caches.keys(); } catch (_) {}

      await self.clients.claim();
      const t1 = (self.performance && self.performance.now) ? self.performance.now() : Date.now();
      const durationMs = Math.round(t1 - t0);

      // Notify open clients with rich activation telemetry.
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const payload = {
        type: "SW_ACTIVATED",
        version: SW_VERSION,
        timestamp: new Date().toISOString(),
        cachesBefore: before,
        cachesDeleted: deleted,
        cachesFailed: failed,
        cachesAfter: after,
        durationMs,
      };
      wins.forEach((c) => { try { c.postMessage(payload); } catch (_) {} });
    })()
  );
});

// Allow the page to force activation of a waiting SW (used by update flow).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "ScoutFoto", body: "Nova notificação" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    console.error("Failed to parse push data:", e);
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "scoutfoto-notification",
    renotify: true,
    data: { url: data.url || "/", ...data.data },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Service Worker for Push Notifications - ScoutFoto
self.addEventListener("push", (event) => {
  let data = { title: "ScoutFoto", body: "Nova notificação" };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
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
    data: {
      url: data.url || "/",
      ...data.data,
    },
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

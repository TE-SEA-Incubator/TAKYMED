self.addEventListener("push", (event) => {
  let payload = { title: "TAKYMED", body: "Nouveau rappel de médicament" };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "TAKYMED", {
      body: payload.body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: payload.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow("/dashboard");
    }),
  );
});

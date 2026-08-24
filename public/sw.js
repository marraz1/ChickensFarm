// ChickensFarm service worker.
//
// Scope is the origin root, which is why this lives in public/ and is served at
// /sw.js rather than from a route. Note src/middleware.ts must exclude it, or a
// signed-out request returns the /login HTML and registration fails.
//
// Deliberately NOT an offline cache. The fetch handler below is a passthrough:
// it exists so the app meets the installability criteria and gets a real
// "Install app" prompt instead of a bookmark-style shortcut, which also matters
// because iOS only delivers web push to an installed app.

self.addEventListener("install", () => {
  // Replace the previous worker immediately rather than waiting for every tab to
  // close. Safe here because there is no cache whose format could change under a
  // running page.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A malformed payload must still show something rather than nothing.
    payload = {};
  }

  const title = payload.title || "ChickensFarm";

  // Only same-origin relative paths. "//evil.com" is protocol-relative and would
  // resolve off-origin in the click handler. The server already controls this
  // payload; the worker still must not trust its input.
  const url =
    typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//")
      ? payload.url
      : "/";

  const options = {
    body: payload.body || "Priminimas",
    icon: "/icon-192.png",
    // No `badge`: Android renders it as a monochrome alpha mask, and icon-192.png
    // has no alpha channel, so it would come out as a solid square in the status
    // bar. Chrome falls back to a generic icon, which looks correct. Add one back
    // only alongside a real 96x96 monochrome asset.
    lang: "lt",
    // Collapses repeats: a re-delivered reminder replaces the previous one
    // instead of stacking up in the shade.
    tag: "chickensfarm-reminder",
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Prefer focusing a tab that is already open — opening a second window
        // on top of a running app is disorienting.
        for (const client of clientList) {
          if ("focus" in client) {
            if ("navigate" in client) {
              return client.focus().then((focused) => focused.navigate(target));
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
      .catch(() => self.clients.openWindow(target)),
  );
});

// Passthrough. Required for installability; intentionally adds no caching.
self.addEventListener("fetch", () => {});

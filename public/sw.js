const CACHE = "nexavault-shell-v6";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["./manifest.webmanifest", "./favicon.png", "./icon-192.png", "./icon-512.png"])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isVolatile(url) {
  return (
    url.pathname.includes("serverFn") ||
    url.pathname.includes("_server") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isVolatile(url)) {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || Promise.reject(new Error("offline")))),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "NexaVault";
  const body = typeof data.body === "string" ? data.body : "";
  const tag = typeof data.tag === "string" ? data.tag : "trust";
  const url = typeof data.url === "string" ? data.url : "./wallet";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag,
      renotify: true,
      lang: "en",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "./wallet";
  event.waitUntil(self.clients.openWindow(url));
});

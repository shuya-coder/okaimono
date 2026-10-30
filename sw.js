const CACHE_NAME = "shopping-app-v4.1.1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest?v=4.1.1",
  "./css/style.css?v=4.1.1",
  "./js/storage.js?v=4.1.1",
  "./js/category.js?v=4.1.1",
  "./js/shopping.js?v=4.1.1",
  "./js/history.js?v=4.1.1",
  "./js/receipt-db.js?v=4.1.1",
  "./js/receipt-manager.js?v=4.1.1",
  "./js/receipt-ui.js?v=4.1.1",
  "./js/ui.js?v=4.1.1",
  "./js/app.js?v=4.1.1",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon.svg",
  "./assets/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", response.clone()));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});

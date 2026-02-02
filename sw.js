const CACHE = "firdaws-store-v1";
const CORE = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // Network-first للـ Google Sheet CSV حتى تبقى المنتجات محدثة
  if (req.url.includes("docs.google.com") || req.url.includes("googleusercontent.com")) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first لباقي الملفات
  e.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});

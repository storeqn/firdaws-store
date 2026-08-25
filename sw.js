// معرض الفردوس - Service Worker
const CACHE_NAME = 'firdaws-data-v3';
const STATIC_CACHE = 'firdaws-static-v3';
const IMG_CACHE = 'firdaws-images-v3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => ![CACHE_NAME, STATIC_CACHE, IMG_CACHE].includes(key))
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // Google Sheets: return cached CSV immediately when available,
  // while refreshing it in the background.
  if (url.hostname.includes('docs.google.com') || url.hostname.includes('googleusercontent.com')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  if (request.destination === 'image' || /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async response => {
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => null);

  if (cached) {
    eventWait(network);
    return cached;
  }

  return (await network) || new Response('', { status: 503 });
}

function eventWait(promise) {
  promise.catch(() => {});
}

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});

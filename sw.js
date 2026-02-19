// ── معرض الفردوس - Service Worker ──
const CACHE_NAME = “firdaws-v2”;
const STATIC_CACHE = “firdaws-static-v2”;
const IMG_CACHE = “firdaws-images-v2”;

// الملفات الأساسية اللي تشتغل بدون إنترنت
const STATIC_ASSETS = [
“./”,
“./index.html”,
“./manifest.json”,
“./icons/icon-192.png”,
“./icons/icon-512.png”
];

// ── التثبيت: حفظ الملفات الأساسية ──
self.addEventListener(“install”, event => {
event.waitUntil(
caches.open(STATIC_CACHE)
.then(cache => cache.addAll(STATIC_ASSETS))
.then(() => self.skipWaiting())
);
});

// ── التفعيل: حذف الكاش القديم ──
self.addEventListener(“activate”, event => {
event.waitUntil(
caches.keys().then(keys =>
Promise.all(
keys
.filter(key => key !== STATIC_CACHE && key !== IMG_CACHE)
.map(key => caches.delete(key))
)
).then(() => self.clients.claim())
);
});

// ── الطلبات: استراتيجية ذكية حسب نوع الملف ──
self.addEventListener(“fetch”, event => {
const url = new URL(event.request.url);

// تجاهل طلبات غير HTTP
if (!event.request.url.startsWith(“http”)) return;

// بيانات Google Sheets - دائماً من الشبكة (Network First)
if (url.hostname.includes(“googleapis.com”) || url.hostname.includes(“google.com”)) {
event.respondWith(networkFirst(event.request));
return;
}

// الصور - Cache First (أسرع تحميل)
if (
event.request.destination === “image” ||
/.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname)
) {
event.respondWith(cacheFirstImages(event.request));
return;
}

// الخطوط - Cache First
if (url.hostname.includes(“fonts.googleapis.com”) || url.hostname.includes(“fonts.gstatic.com”)) {
event.respondWith(cacheFirst(event.request, STATIC_CACHE));
return;
}

// الملفات الأساسية (HTML, JS, CSS) - Stale While Revalidate
event.respondWith(staleWhileRevalidate(event.request));
});

// ── استراتيجية: Network First (للبيانات المتغيرة) ──
async function networkFirst(request) {
try {
const response = await fetch(request);
if (response.ok) {
const cache = await caches.open(CACHE_NAME);
cache.put(request, response.clone());
}
return response;
} catch {
const cached = await caches.match(request);
return cached || new Response(””, { status: 503 });
}
}

// ── استراتيجية: Cache First (للصور) ──
async function cacheFirstImages(request) {
const cached = await caches.match(request);
if (cached) return cached;
try {
const response = await fetch(request);
if (response.ok && response.status === 200) {
const cache = await caches.open(IMG_CACHE);
// حفظ الصور بس إذا مو كبيرة جداً
const clone = response.clone();
cache.put(request, clone).catch(() => {});
}
return response;
} catch {
return new Response(””, { status: 404 });
}
}

// ── استراتيجية: Cache First العادي ──
async function cacheFirst(request, cacheName = CACHE_NAME) {
const cached = await caches.match(request);
if (cached) return cached;
try {
const response = await fetch(request);
if (response.ok) {
const cache = await caches.open(cacheName);
cache.put(request, response.clone());
}
return response;
} catch {
return new Response(””, { status: 503 });
}
}

// ── استراتيجية: Stale While Revalidate (للصفحة الرئيسية) ──
async function staleWhileRevalidate(request) {
const cached = await caches.match(request);

const fetchPromise = fetch(request).then(response => {
if (response.ok) {
const cache = caches.open(STATIC_CACHE);
cache.then(c => c.put(request, response.clone()));
}
return response;
}).catch(() => null);

// رجّع الكاش فوراً إذا موجود، وبنفس الوقت حدّث من الشبكة بالخلفية
return cached || fetchPromise || new Response(””, { status: 503 });
}

// ── رسالة من الصفحة (مثل: تحديث يدوي) ──
self.addEventListener(“message”, event => {
if (event.data === “SKIP_WAITING”) {
self.skipWaiting();
}
if (event.data === “CLEAR_CACHE”) {
caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
}
});
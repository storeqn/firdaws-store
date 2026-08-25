// معرض الفردوس - Service Worker
const STATIC_CACHE='firdaws-static-v5';
const IMG_CACHE='firdaws-images-v5';
const STATIC_ASSETS=['./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(STATIC_ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>![STATIC_CACHE,IMG_CACHE].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||!request.url.startsWith('http'))return;
  const url=new URL(request.url);

  // Never cache Google Sheets CSV. Product data must always be current.
  if(url.hostname.includes('docs.google.com')||url.hostname.includes('googleusercontent.com')){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }

  // Always request the newest HTML so old app-shell code cannot get stuck on iPhone.
  if(request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/firdaws-store/')){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }

  if(request.destination==='image'||/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)){
    event.respondWith(cacheFirst(request,IMG_CACHE));
    return;
  }

  event.respondWith(networkFirst(request,STATIC_CACHE));
});

async function cacheFirst(request,cacheName){
  const cached=await caches.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response&&response.ok){const cache=await caches.open(cacheName);cache.put(request,response.clone()).catch(()=>{});}
  return response;
}

async function networkFirst(request,cacheName){
  try{
    const response=await fetch(request);
    if(response&&response.ok){const cache=await caches.open(cacheName);cache.put(request,response.clone()).catch(()=>{});}
    return response;
  }catch{
    return (await caches.match(request))||new Response('',{status:503});
  }
}

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING')self.skipWaiting();
  if(event.data==='CLEAR_CACHE')event.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))));
});

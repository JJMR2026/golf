const CACHE_NAME = 'golf-tracker-v3';
const urlsToCache = [ './', './index.html', './manifest.json' ];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(cacheNames => Promise.all(cacheNames.map(cache => { if (cache !== CACHE_NAME) return caches.delete(cache); }))));
});

// NETWORK FIRST STRATEGY
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

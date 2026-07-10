// Minimal Service Worker to allow PWA Installation and basic offline caching
const CACHE_NAME = 'golf-tracker-v2'; // Changed from v1 to v2 to force a refresh
const urlsToCache = [ './', './index.html', './manifest.json' ];

self.addEventListener('install', event => {
    self.skipWaiting(); // Forces the new service worker to activate immediately
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache); // Deletes v1
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});

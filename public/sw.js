// public/sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Apenas passa as requisições para frente para manter o app online
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
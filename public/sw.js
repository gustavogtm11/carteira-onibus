// public/sw.js
const CACHE_NAME = 'passe-livre-cache-v3';

// Instalação limpa
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

// Estratégia Stale-While-Revalidate / Cache Dinâmico
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não sejam GET ou que sejam do Firebase Auth / Firestore (APIs externas dinâmicas)
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('identitytoolkit')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Retorna do cache se existir
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Se a resposta da rede for válida, atualiza o cache em segundo plano
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Se estiver offline e não achar no cache, retorna o index.html para rotas SPA
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
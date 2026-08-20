// public/sw.js
const CACHE_NAME = 'passe-livre-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instala o Service Worker e guarda os arquivos básicos em cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
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

// Intercepta as requisições com tratamento seguro para evitar 'null' no iOS
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não sejam GET ou que sejam do Firebase/externas se necessário
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta da rede for válida, podemos opcionalmente guardá-la em cache
        return response;
      })
      .catch(() => {
        // Se falhar (sem internet), busca no cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Se for uma navegação de página e não achar no cache, retorna o index.html principal
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }

          // Se nada for encontrado, retorna uma resposta vazia segura em vez de null (evita o erro do iOS)
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});
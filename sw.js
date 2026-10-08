/* Service worker: cachea la app para que funcione offline.
   Estrategia: red primero, caché de respaldo. Sube CACHE al cambiar archivos. */
const CACHE = 'rutina-v5';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './guides.js', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero (así las actualizaciones aparecen al abrir la app con internet) y caché como
// respaldo sin conexión. `no-cache` evita que el caché HTTP de GitHub Pages sirva archivos viejos.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

// Al tocar una notificación, abre/enfoca la app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

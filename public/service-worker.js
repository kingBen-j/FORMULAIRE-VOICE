/* VOICE OF GOD — Service Worker (PWA installable + coque hors-ligne) */
'use strict';

const CACHE = 'vog-v1';
const CORE = [
  '/', '/presence',
  '/app.js', '/presence.js',
  '/logo-vog.png', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Ne jamais mettre en cache l'admin ni l'API (données sensibles / dynamiques).
  if (sameOrigin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin'))) {
    return; // laisse passer au réseau normalement
  }

  // Navigation (pages HTML) : réseau d'abord, cache en secours.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { cachePut(req, res.clone()); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Fichiers statiques même origine : cache d'abord, puis réseau.
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => { cachePut(req, res.clone()); return res; }).catch(() => cached)
      )
    );
    return;
  }

  // Ressources externes (polices Google) : réseau, secours cache.
  event.respondWith(
    fetch(req).then((res) => { cachePut(req, res.clone()); return res; }).catch(() => caches.match(req))
  );
});

function cachePut(req, res) {
  if (!res || (res.status !== 200 && res.type !== 'opaque')) return;
  caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {});
}

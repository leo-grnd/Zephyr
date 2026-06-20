// ZÉPHYR service worker — network-first pour le shell, stale-while-revalidate
// pour les CDN (fonts, Leaflet), bypass total pour les API et tuiles.
// Bump VERSION à chaque release.
const VERSION = 'zephyr-v3';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './icons.js',
  './charts.js',
  './api.js',
  './app.js',
  './comment-ca-marche.html',
  './comment-ca-marche.css',
  './favicon.svg',
  './og-image.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => null)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API & tuiles : ne pas cacher (l'app gère ses données ; tuiles trop volumineuses).
  const bypass = [
    'open-meteo.com', 'rainviewer.com', 'bigdatacloud.net',
    'meteofrance.fr', 'corsproxy.io', 'openstreetmap.org', 'api.gouv.fr'
  ];
  if (bypass.some(h => url.hostname.includes(h))) return;

  // Même origine (shell) → network-first, fallback cache.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const c = res.clone(); caches.open(VERSION).then(cc => cc.put(req, c)).catch(() => {}); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // CDN externes (Google Fonts, Leaflet) : stale-while-revalidate.
  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(req).then(cached => {
        const fp = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()).catch(() => {}); return res; }).catch(() => cached);
        return cached || fp;
      })
    )
  );
});

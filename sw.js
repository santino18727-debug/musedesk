// sw.js — Service worker MuseDesk (app shell offline)
const CACHE = 'musedesk-v9';
// Les URLs versionnées (?v=4) doivent matcher EXACTEMENT celles requêtées par
// le navigateur, sinon cache.match() rate et on perd le offline.
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=4',
  './app.js?v=4',
  './sync.js?v=4',
  './db.js?v=4',
  './parser.js?v=4',
  './config.js?v=4',
  './fsprovider.js?v=4',
  './pdfimport.js?v=4',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first pour les assets, réseau pour tout le reste
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});

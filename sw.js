// sw.js — Service worker MuseDesk (app shell offline)
const CACHE = 'musedesk-v7';
// Les URLs versionnées (?v=3) doivent matcher EXACTEMENT celles requêtées par
// le navigateur, sinon cache.match() rate et on perd le offline.
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=3',
  './app.js?v=3',
  './sync.js?v=3',
  './db.js?v=3',
  './parser.js?v=3',
  './config.js?v=3',
  './fsprovider.js?v=3',
  './pdfimport.js?v=3',
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

// sw.js — Service worker MuseDesk (app shell offline)
const CACHE = 'musedesk-v13';
// Les URLs versionnées (?v=8) doivent matcher EXACTEMENT celles requêtées par
// le navigateur, sinon cache.match() rate et on perd le offline.
// Assets CORE : indispensables au shell offline → précache ATOMIQUE (addAll).
// Si l'un manque, l'install échoue volontairement (on ne veut pas d'un shell cassé).
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=8',
  './app.js?v=8',
  './sync.js?v=8',
  './db.js?v=8',
  './parser.js?v=8',
  './config.js?v=8',
  './live.js?v=8',
  './fsprovider.js?v=8',
  './pdfimport.js?v=8',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// Assets OPTIONNELS : précache TOLÉRANT (un 404 ne casse pas l'install du SW).
// qrcode.min.js n'est utile qu'au mode pupitre (en ligne) ; tant que le vendor
// n'est pas déposé, son absence ne doit PAS empêcher l'app de s'installer.
const OPTIONAL_ASSETS = [
  './vendor/qrcode.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(ASSETS); // atomique : indispensable au offline
      await Promise.allSettled(OPTIONAL_ASSETS.map((u) => c.add(u))); // best-effort
    })
  );
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

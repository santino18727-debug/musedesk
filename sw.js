// sw.js — Service worker MuseDesk (app shell offline)
const CACHE = 'musedesk-v20';
// Les URLs versionnées (?v=14) doivent matcher EXACTEMENT celles requêtées par
// le navigateur, sinon cache.match() rate et on perd le offline.
// Assets CORE : indispensables au shell offline → précache ATOMIQUE (addAll).
// Si l'un manque, l'install échoue volontairement (on ne veut pas d'un shell cassé).
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=14',
  './app.js?v=14',
  './sync.js?v=14',
  './db.js?v=14',
  './parser.js?v=14',
  './config.js?v=14',
  './live.js?v=14',
  './fsprovider.js?v=14',
  './pdfimport.js?v=14',
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

// S6 — Stratégie hybride :
//   • Shell NON versionné (navigation, index.html, ./, manifest.json) → NETWORK-FIRST
//     (sinon une nouvelle index.html, qui pointe vers ?v=N+1, n'est jamais
//      récupérée tant que CACHE ne change pas → app figée).
//   • Assets versionnés (?v=N) + vendors → CACHE-FIRST (l'URL change à chaque
//     release, donc le cache est toujours frais et l'offline garanti).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isShell =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/manifest.json');

  if (isShell) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request)) // offline → dernière copie connue
    );
    return;
  }

  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});

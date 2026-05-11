const CACHE = 'aurora-v3';
const DATA_ONLY = [
  './data/cards.json',
  './data/entities.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(DATA_ONLY)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ไม่แตะ API calls และ JS/CSS — ให้โหลดจาก network เสมอ
  if (url.hostname.includes('googleapis.com')) return;
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) return;

  // cache-first สำหรับ data files เท่านั้น
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});

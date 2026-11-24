/* Тактиль — service worker: быстрый повторный заход и работа офлайн.
   HTML/JS/CSS — сначала сеть (правки видны сразу), при отсутствии сети — кэш.
   Картинки и шрифты — сначала кэш. */
const VERSION = 'tactile-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  const media = r.destination === 'image' || /\.(svg|png|jpe?g|webp|ico)$/i.test(u.pathname);
  if (media) {
    e.respondWith(caches.open(VERSION).then((c) => c.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit || Response.error()))));
    return;
  }
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r).then((h) => h || caches.match('index.html') || Response.error())));
});

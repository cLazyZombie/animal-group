const CACHE = 'animal-loop-v8';
const ROOT = new URL('./', self.location.href);
const ANIMALS = ['toucan', 'monkey', 'anteater', 'redpanda', 'crocodile', 'ray', 'clownfish', 'sunfish', 'whaleshark', 'seadragon', 'crowned-crane', 'eagle', 'gull', 'sky-toucan', 'macaw'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(ROOT);
    await cache.put(ROOT, response.clone());
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^\"]+\/assets\/[^\"]+)"/g)].map(match => match[1]);
    await cache.addAll(['manifest.webmanifest', 'favicon-64.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', ...ANIMALS.map(id => `animals/${id}.png`), ...assets].map(path => new URL(path, ROOT)));
  })());
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});

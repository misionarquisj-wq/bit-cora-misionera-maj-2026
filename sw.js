const CACHE = 'bitacora-maj-2026-v1';
const ASSETS = [
  './','./index.html','./style.css','./script.js','./manifest.webmanifest',
  './images/ui/portada.png','./images/ui/cruz-maj.png','./images/ui/oido.png','./images/ui/logo-maj.png','./images/ui/icon-192.png','./images/ui/icon-512.png',
  './images/maps/map-015.png','./images/maps/map-016.png','./images/maps/map-017.png','./images/maps/map-018.png','./images/maps/map-019.png',
  './images/maps/map-020.png','./images/maps/map-021.png','./images/maps/map-022.png','./images/maps/map-023.png','./images/maps/map-024.png'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});

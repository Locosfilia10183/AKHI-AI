/* AKHI AI: bewusst kein Offline-HTML-Caching, damit Updates sofort sichtbar sind. */
self.addEventListener("install", event => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("akhi-ai")).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  // Netzwerk direkt verwenden; keine veralteten leeren HTML/CSS-Dateien ausliefern.
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

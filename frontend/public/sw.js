// Legacy service worker cleanup.
// This project no longer uses an offline cache because stale cached shells
// were causing normal reloads to serve old HTML, images, and API responses.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.clients.claim();
    const registrations = await self.registration.unregister();
    if (registrations) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    }
  })());
});

self.addEventListener('fetch', () => {
  // Intentionally no-op.
});

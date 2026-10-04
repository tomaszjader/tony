const CACHE = '__TONY_CACHE__';
const FILES = __TONY_FILES__;
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(FILES.map((file) => new URL(file, self.registration.scope).href)),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tony-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached && request.mode !== 'navigate') return cached;
      try {
        const response = await fetch(request);
        if (response.ok || (!cached && request.mode !== 'navigate')) return response;
      } catch {}
      return (
        cached ||
        (request.mode === 'navigate'
          ? await caches.match(new URL('index.html', self.registration.scope).href)
          : Response.error())
      );
    })(),
  );
});

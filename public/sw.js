// App shell cache only. Never caches /api, so no personal data is stored by the service worker.
const SHELL = 'eams-shell-v1';
const ASSETS = 'eams-assets-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/') || url.pathname === '/up') return;

    // Page loads: network first, fall back to the cached shell when offline.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    if (response.ok) caches.open(SHELL).then((c) => c.put('/shell', copy));
                    return response;
                })
                .catch(() => caches.match('/shell').then((r) => r ?? Response.error())),
        );
        return;
    }

    // Built files have hashed names, so cache first is safe. Brand images and the manifest too.
    if (url.pathname.startsWith('/build/') || url.pathname.startsWith('/images/brand/')) {
        event.respondWith(
            caches.match(request).then(
                (hit) =>
                    hit ??
                    fetch(request).then((response) => {
                        if (response.ok) {
                            const copy = response.clone();
                            caches.open(ASSETS).then((c) => c.put(request, copy));
                        }
                        return response;
                    }),
            ),
        );
    }
});

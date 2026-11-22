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
    if (url.pathname.startsWith('/build/') || url.pathname.startsWith('/images/brand/') || url.pathname.startsWith('/sounds/')) {
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

// Push alerts. The payload is short and generic: title, body, url, urgent, tag. No names, no places.
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = {};
    }
    const urgent = data.urgent === true;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            // The app is on screen: it refreshes its alerts and plays its own sound, so no second banner.
            const visible = clients.filter((c) => c.visibilityState === 'visible');
            if (visible.length > 0) {
                visible.forEach((c) => c.postMessage({ type: 'eams-push', urgent }));
                if (data.tag !== 'test') return undefined;
            }
            return self.registration.showNotification(data.title || 'DRRMO EAMS', {
                body: data.body || '',
                icon: '/images/brand/icon-192.png',
                badge: '/images/brand/icon-192.png',
                tag: data.tag || 'eams',
                renotify: true,
                // Urgent: strong vibration and stays on screen until dismissed (Android). A web push cannot
                // pick its own sound. The phone uses its default and obeys silent mode.
                vibrate: urgent ? [600, 200, 600, 200, 600, 200, 600] : [200],
                requireInteraction: urgent,
                data: { url: data.url || '/', urgent },
            });
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const open = clients.find((c) => new URL(c.url).origin === self.location.origin);
            if (open) {
                return open.focus().then(() => ('navigate' in open ? open.navigate(target) : undefined));
            }
            return self.clients.openWindow(target);
        }),
    );
});

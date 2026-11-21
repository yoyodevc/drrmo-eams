// App entry. Keep this file free of components: it only wires the providers and mounts the app.
// A component defined here would make Vite's hot reload run this whole file a second time.
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { BootRelease } from './BootScreen';
import { SessionWatcher } from './SessionWatcher';

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const container = document.getElementById('app');

if (container) {
    // In development this file can be evaluated again. Reuse the same root instead of calling
    // createRoot a second time on the same container, which breaks React's DOM bookkeeping.
    const hotData = import.meta.hot?.data as { root?: Root } | undefined;
    const root = hotData?.root ?? createRoot(container);
    if (hotData) hotData.root = root;

    root.render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <SessionWatcher />
                <RouterProvider router={router} />
                <BootRelease />
            </QueryClientProvider>
        </StrictMode>,
    );
}

// App shell cache so the app installs to the home screen. Production builds only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js');
    });
}

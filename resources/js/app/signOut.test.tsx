import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from '@/pages/Login';
import { api, blockRefresh } from '@/shared/api/client';
import { useSessionWatcher } from './auth';
import { RequireAuth } from './RequireAuth';
import { SignOutButton } from './SignOutButton';

const marshal = {
    id: 1,
    first_name: 'Test',
    last_name: 'Marshal',
    name: 'Test Marshal',
    email: 'marshal@example.test',
    role: 'marshal',
    team: null,
    status: 'active',
    permissions: [],
    consent: { privacy_notice: true, privacy_notice_outdated: false, location_tracking: false },
    home: '/me',
};

function json(status: number, body: unknown = {}) {
    return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));
}

// A stand-in for BroadcastChannel that delivers messages to the other "tabs" (instances).
class FakeChannel {
    static all: FakeChannel[] = [];
    onmessage: ((event: MessageEvent) => void) | null = null;
    closed = false;
    constructor(public name: string) {
        FakeChannel.all.push(this);
    }
    postMessage(data: unknown) {
        FakeChannel.all
            .filter((other) => other !== this && !other.closed && other.name === this.name)
            .forEach((other) => other.onmessage?.({ data } as MessageEvent));
    }
    close() {
        this.closed = true;
    }
}

function Watcher() {
    useSessionWatcher();
    return null;
}

// Fetches some private data, like a real page would.
function Private() {
    const { data } = useQuery({
        queryKey: ['events'],
        queryFn: () => api<{ data: string }>('/api/events'),
    });
    return <p>{typeof data?.data === 'string' ? data.data : 'loading'}</p>;
}

function renderApp(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    const router = createMemoryRouter(
        [
            { path: '/login', element: <Login /> },
            {
                element: <RequireAuth area="/me" />,
                children: [
                    {
                        path: '/me',
                        element: (
                            <>
                                <h1>My duties</h1>
                                <Private />
                                <SignOutButton />
                            </>
                        ),
                    },
                ],
            },
        ],
        { initialEntries: ['/me'] },
    );
    render(
        <QueryClientProvider client={client}>
            <Watcher />
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );
    return { client, router };
}

// Opens the confirmation dialog, then confirms inside it.
async function confirmSignOut() {
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    fireEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sign out' }),
    );
}

beforeEach(() => {
    FakeChannel.all = [];
    blockRefresh(false);
    vi.stubGlobal('BroadcastChannel', FakeChannel);
});

afterEach(() => {
    cleanup();
    blockRefresh(false);
    vi.unstubAllGlobals();
});

describe('sign out', () => {
    it('clears the whole query cache, not only the signed-in user', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) => {
                if (url === '/api/logout') return json(204);
                if (url === '/api/events') return json(200, { data: 'private events' });
                return json(200, { data: marshal });
            }),
        );
        const { client } = renderApp();
        expect(await screen.findByText('private events')).toBeInTheDocument();
        expect(client.getQueryData(['events'])).toBeDefined();

        await confirmSignOut();

        expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
        expect(client.getQueryData(['events'])).toBeUndefined();
        expect(client.getQueryData(['me'])).toBeNull();
    });

    it('sends one request and disables the button while it waits', async () => {
        let finish: () => void = () => {};
        const fetchMock = vi.fn((url: string) => {
            if (url === '/api/logout') {
                return new Promise<Response>((resolve) => {
                    finish = () => resolve(new Response(null, { status: 204 }));
                });
            }
            return json(200, { data: marshal });
        });
        vi.stubGlobal('fetch', fetchMock);
        renderApp();

        fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
        const dialog = await screen.findByRole('alertdialog');
        const button = within(dialog).getByRole('button', { name: 'Sign out' });
        fireEvent.click(button);
        fireEvent.click(button);

        const busy = await screen.findByRole('button', { name: 'Signing out...' });
        expect(busy).toBeDisabled();
        expect(fetchMock.mock.calls.filter(([url]) => url === '/api/logout')).toHaveLength(1);

        finish();
        expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('treats 419 as already signed out', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) =>
                url === '/api/logout' ? json(419, {}) : json(200, { data: marshal }),
            ),
        );
        renderApp();

        await confirmSignOut();

        expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('stays signed in on a server error, can try again, and allows refresh again', async () => {
        let failing = true;
        const fetchMock = vi.fn((url: string) => {
            if (url === '/api/logout') return failing ? json(500, {}) : json(204);
            return json(200, { data: marshal });
        });
        vi.stubGlobal('fetch', fetchMock);
        renderApp();

        await confirmSignOut();
        const dialog = screen.getByRole('alertdialog');
        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Could not sign out. Try again.',
        );
        expect(screen.getByRole('heading', { name: 'My duties' })).toBeInTheDocument();

        // Still signed in, so an expired token must still be refreshed.
        const calls = fetchMock.mock.calls.length;
        fetchMock.mockImplementation((url: string) =>
            url === '/api/refresh'
                ? json(204)
                : url === '/api/x' && fetchMock.mock.calls.length < calls + 3
                  ? json(401)
                  : json(200, {}),
        );
        await api('/api/x');
        expect(fetchMock.mock.calls.some(([url]) => url === '/api/refresh')).toBe(true);

        failing = false;
        fetchMock.mockImplementation((url: string) =>
            url === '/api/logout' ? json(204) : json(200, { data: marshal }),
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));
        expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('tells other tabs to sign out', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) =>
                url === '/api/logout' ? json(204) : json(200, { data: marshal }),
            ),
        );
        renderApp();
        const otherTab = new FakeChannel('drrmo-auth');
        const heard = vi.fn();
        otherTab.onmessage = (event) => heard(event.data);

        await confirmSignOut();

        await waitFor(() => expect(heard).toHaveBeenCalledWith('signed-out'));
    });
});

describe('sign out confirmation', () => {
    function logoutCalls(fetchMock: ReturnType<typeof vi.fn>) {
        return fetchMock.mock.calls.filter(([url]) => url === '/api/logout');
    }

    function stub() {
        const fetchMock = vi.fn((url: string) =>
            url === '/api/logout' ? json(204) : json(200, { data: marshal }),
        );
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    it('asks first and does not call the server when opened', async () => {
        const fetchMock = stub();
        renderApp();

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toHaveAccessibleName('Sign out?');
        expect(dialog).toHaveAccessibleDescription(
            'You will need your email and password to sign in again.',
        );
        expect(logoutCalls(fetchMock)).toHaveLength(0);
    });

    it('starts with focus on Cancel and keeps the user signed in when cancelled', async () => {
        const fetchMock = stub();
        renderApp();
        fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

        const cancel = within(await screen.findByRole('alertdialog')).getByRole('button', {
            name: 'Cancel',
        });
        expect(cancel).toHaveFocus();

        fireEvent.click(cancel);

        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(screen.getByRole('heading', { name: 'My duties' })).toBeInTheDocument();
        expect(logoutCalls(fetchMock)).toHaveLength(0);
    });

    it('cancels with Esc and returns focus to the Sign out button', async () => {
        const fetchMock = stub();
        renderApp();
        const trigger = await screen.findByRole('button', { name: 'Sign out' });
        trigger.focus();
        fireEvent.click(trigger);

        fireEvent(
            await screen.findByRole('alertdialog'),
            new Event('cancel', { cancelable: true }),
        );

        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
        expect(logoutCalls(fetchMock)).toHaveLength(0);
    });

    it('cancels when the backdrop is clicked', async () => {
        const fetchMock = stub();
        renderApp();
        fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

        fireEvent.click(await screen.findByRole('alertdialog'));

        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(logoutCalls(fetchMock)).toHaveLength(0);
    });

    it('ignores Esc, the backdrop and Cancel while signing out', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) =>
                url === '/api/logout'
                    ? new Promise<Response>(() => {})
                    : json(200, { data: marshal }),
            ),
        );
        renderApp();
        fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));
        await within(dialog).findByRole('button', { name: 'Signing out...' });

        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
        fireEvent(dialog, new Event('cancel', { cancelable: true }));
        fireEvent.click(dialog);

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('stays open with an error when sign out fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) =>
                url === '/api/logout' ? json(500, {}) : json(200, { data: marshal }),
            ),
        );
        renderApp();
        await confirmSignOut();

        const dialog = screen.getByRole('alertdialog');
        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Could not sign out. Try again.',
        );
        expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeEnabled();
        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    });
});

describe('signed out in another tab', () => {
    it('sends this tab to the login page at once and clears its data', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) =>
                url === '/api/events'
                    ? json(200, { data: 'private events' })
                    : json(200, { data: marshal }),
            ),
        );
        const { client } = renderApp();
        expect(await screen.findByText('private events')).toBeInTheDocument();

        const otherTab = new FakeChannel('drrmo-auth');
        act(() => otherTab.postMessage('signed-out'));

        expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
        expect(client.getQueryData(['events'])).toBeUndefined();
    });

    it('does not refresh quietly after the other tab signed out', async () => {
        const fetchMock = vi.fn((url: string) =>
            url === '/api/me' ? json(200, { data: marshal }) : json(401),
        );
        vi.stubGlobal('fetch', fetchMock);
        renderApp();
        await screen.findByRole('heading', { name: 'My duties' });

        const otherTab = new FakeChannel('drrmo-auth');
        act(() => otherTab.postMessage('signed-out'));
        await screen.findByRole('button', { name: 'Sign in' });

        // The page's own first load may have tried a refresh. Count only what comes after.
        const refreshes = () =>
            fetchMock.mock.calls.filter(([url]) => url === '/api/refresh').length;
        const before = refreshes();
        await expect(api('/api/events')).rejects.toThrow();
        expect(refreshes()).toBe(before);
    });

    it('checks again when the page comes back from the back/forward cache', async () => {
        const fetchMock = vi.fn((url: string) =>
            url === '/api/me' ? json(200, { data: marshal }) : json(200, { data: 'x' }),
        );
        vi.stubGlobal('fetch', fetchMock);
        renderApp();
        await screen.findByRole('heading', { name: 'My duties' });
        const before = fetchMock.mock.calls.filter(([url]) => url === '/api/me').length;

        const event = new Event('pageshow') as PageTransitionEvent;
        Object.defineProperty(event, 'persisted', { value: true });
        act(() => {
            window.dispatchEvent(event);
        });

        await waitFor(() =>
            expect(
                fetchMock.mock.calls.filter(([url]) => url === '/api/me').length,
            ).toBeGreaterThan(before),
        );
    });
});

describe('a session that ended on the server', () => {
    it('signs out cleanly and shows the login page when the refresh fails', async () => {
        const fetchMock = vi.fn((url: string) => {
            if (url === '/api/me') return json(200, { data: marshal });
            return json(401);
        });
        vi.stubGlobal('fetch', fetchMock);
        const { client } = renderApp();
        await screen.findByRole('heading', { name: 'My duties' });

        await expect(api('/api/events')).rejects.toThrow();

        expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
        expect(client.getQueryData(['me'])).toBeNull();
    });
});

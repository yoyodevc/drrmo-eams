import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessRequests } from '@/features/personnel/pages/admin/AccessRequests';
import { Login } from './Login';
import { RequestAccess } from './RequestAccess';
import { VerifyEmail } from './VerifyEmail';
import { WaitingForApproval } from './WaitingForApproval';

function json(status: number, body: unknown) {
    return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));
}

function renderAt(path: string) {
    const router = createMemoryRouter(
        [
            { path: '/login', element: <Login /> },
            { path: '/register', element: <RequestAccess /> },
            { path: '/register/verify', element: <VerifyEmail /> },
            { path: '/register/pending', element: <WaitingForApproval /> },
            { path: '/admin/requests', element: <AccessRequests /> },
        ],
        { initialEntries: [path] },
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );
    return router;
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, url: string) {
    const call = fetchMock.mock.calls.find(([called]) => called === url);
    return JSON.parse((call?.[1] as RequestInit).body as string);
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('request access', () => {
    it('is linked from the sign in screen', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => json(401, {})),
        );
        renderAt('/login');
        expect(await screen.findByRole('link', { name: 'Request access' })).toHaveAttribute(
            'href',
            '/register',
        );
    });

    it('checks the form before it calls the server', async () => {
        const fetchMock = vi.fn(() => json(202, {}));
        vi.stubGlobal('fetch', fetchMock);
        renderAt('/register');

        fireEvent.click(screen.getByRole('button', { name: 'Request access' }));

        expect(await screen.findByText('Enter your first name.')).toBeInTheDocument();
        expect(screen.getByText('Enter your last name.')).toBeInTheDocument();
        expect(screen.getByText('You need to agree to continue.')).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the request and moves to the code screen', async () => {
        const fetchMock = vi.fn(() => json(202, { message: 'sent' }));
        vi.stubGlobal('fetch', fetchMock);
        const router = renderAt('/register');

        fireEvent.change(screen.getByLabelText('First name'), { target: { value: ' Ana ' } });
        fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Reyes' } });
        fireEvent.change(screen.getByLabelText('Email'), {
            target: { value: 'ana@example.test' },
        });
        fireEvent.change(screen.getByLabelText('Password'), {
            target: { value: 'a-long-safe-password' },
        });
        fireEvent.change(screen.getByLabelText('Confirm password'), {
            target: { value: 'a-long-safe-password' },
        });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Request access' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/register/verify'));
        expect(router.state.location.search).toBe('?email=ana%40example.test');
        expect(bodyOf(fetchMock, '/api/register')).toMatchObject({
            first_name: 'Ana',
            last_name: 'Reyes',
            email: 'ana@example.test',
            privacy_consent: true,
        });
    });
});

describe('confirm email', () => {
    it('asks for a 6 digit code and shows a wrong code message', async () => {
        const fetchMock = vi.fn(() => json(422, { code: 'invalid_code' }));
        vi.stubGlobal('fetch', fetchMock);
        renderAt('/register/verify?email=ana%40example.test');

        fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));
        expect(
            await screen.findByText('Enter the 6 digit code from the email.'),
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Confirmation code'), {
            target: { value: '123456' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));
        expect(await screen.findByText('That code is wrong or has expired.')).toBeInTheDocument();
    });

    it('asks for a new code after too many wrong tries', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => json(422, { code: 'code_locked' })),
        );
        renderAt('/register/verify?email=ana%40example.test');

        fireEvent.change(screen.getByLabelText('Confirmation code'), {
            target: { value: '123456' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));

        expect(
            await screen.findByText('Too many wrong codes. Ask for a new code.'),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send a new code in 60s' })).toBeDisabled();
    });

    it('moves to the waiting screen when the code is right', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => json(200, { message: 'ok' })),
        );
        const router = renderAt('/register/verify?email=ana%40example.test');

        fireEvent.change(screen.getByLabelText('Confirmation code'), {
            target: { value: '123456' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/register/pending'));
        expect(
            await screen.findByRole('heading', { name: 'Waiting for approval' }),
        ).toBeInTheDocument();
    });
});

describe('admin access requests', () => {
    const row = {
        id: 7,
        first_name: 'Ana',
        last_name: 'Reyes',
        name: 'Ana Reyes',
        email: 'ana@example.test',
        account_status: 'pending_approval',
        requested_at: '2026-11-06T01:00:00Z',
        email_verified_at: '2026-11-06T01:02:00Z',
        reviewed_at: null,
        rejection_reason: null,
    };

    const counts = { pending_approval: 1, pending_email: 0, active: 0, rejected: 0, all: 1 };

    it('lists requests, approves one after asking and needs a reason to reject', async () => {
        const fetchMock = vi.fn((url: string) =>
            url.includes('/approve')
                ? json(200, { data: row })
                : json(200, { data: [row], counts }),
        );
        vi.stubGlobal('fetch', fetchMock);
        renderAt('/admin/requests');

        expect((await screen.findAllByText('ana@example.test')).length).toBeGreaterThan(0);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            '/api/admin/registrations?status=pending_approval',
        );

        // Approve asks first, so a stray click does not let someone in.
        fireEvent.click(screen.getAllByRole('button', { name: 'Approve Ana Reyes' })[0]);
        expect(fetchMock.mock.calls.some(([u]) => u.includes('/approve'))).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(([u]) => u === '/api/admin/registrations/7/approve'),
            ).toBe(true),
        );

        expect(
            await screen.findByText('Ana Reyes is approved and can sign in now. We emailed them.'),
        ).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'Reject Ana Reyes' })[0]);
        const submit = screen.getByRole('button', { name: 'Reject request' });
        expect(submit).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Not a volunteer' } });
        expect(submit).toBeEnabled();
    });

    it('filters by status', async () => {
        const fetchMock = vi.fn<(url: string) => Promise<Response>>(() =>
            json(200, {
                data: [],
                counts: { pending_approval: 0, pending_email: 0, active: 0, rejected: 0, all: 0 },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);
        renderAt('/admin/requests');

        fireEvent.click(await screen.findByRole('button', { name: /^Rejected/ }));
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(
                    ([u]) => u === '/api/admin/registrations?status=rejected',
                ),
            ).toBe(true),
        );
        expect((await screen.findAllByText('No rejected requests')).length).toBeGreaterThan(0);
    });
});

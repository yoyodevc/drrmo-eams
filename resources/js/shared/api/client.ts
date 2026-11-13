// Small fetch wrapper for the Laravel API. Owned by Core.
// Auth lives in two HttpOnly cookies (access and refresh token) that this code never reads.
// The X-Requested-With header marks calls as coming from the app (CSRF check on the server).

export class ApiError extends Error {
    constructor(
        public status: number,
        public body: unknown,
        // Seconds from the Retry-After header, when the server sent one.
        public retryAfter?: number,
    ) {
        // Show the server's own words when it sent some ("Location consent is needed to start duty.").
        super(
            typeof (body as { message?: unknown } | null)?.message === 'string' &&
                (body as { message: string }).message !== ''
                ? (body as { message: string }).message
                : `API error ${status}`,
        );
    }
}

// Calls that must never trigger a token refresh.
const noRefresh = new Set([
    '/api/login',
    '/api/refresh',
    '/api/logout',
    '/api/forgot-password',
    '/api/reset-password',
]);

let refreshing: Promise<boolean> | null = null;

// After sign out nothing may quietly sign the person back in, so a 401 no longer triggers a
// refresh. Login lifts the block again.
let refreshBlocked = false;

export function blockRefresh(blocked: boolean): void {
    refreshBlocked = blocked;
}

// Called when a signed-in call could not be saved by a refresh: the session is over for good.
// The app clears all its state and the route guards send the person to the login page.
type SessionEndedListener = () => void;
const sessionEndedListeners = new Set<SessionEndedListener>();

export function onSessionEnded(listener: SessionEndedListener): () => void {
    sessionEndedListeners.add(listener);
    return () => sessionEndedListeners.delete(listener);
}

// Called when the server answers 403 `consent_required`: the privacy notice changed mid session.
// The app then asks /api/me again and the consent screen shows itself.
type ConsentListener = () => void;
const consentListeners = new Set<ConsentListener>();

export function onConsentRequired(listener: ConsentListener): () => void {
    consentListeners.add(listener);
    return () => consentListeners.delete(listener);
}

function signalSessionEnded(): void {
    sessionEndedListeners.forEach((listener) => listener());
}

// One refresh at a time. Every call that got a 401 meanwhile waits for the same answer.
export function refreshSession(): Promise<boolean> {
    refreshing ??= fetch('/api/refresh', {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    })
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => {
            refreshing = null;
        });
    return refreshing;
}

function send(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (init.body && !(init.body instanceof FormData))
        headers.set('Content-Type', 'application/json');

    return fetch(path, { ...init, headers, credentials: 'same-origin' });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response = await send(path, init);

    // The access token lasts 15 minutes. On a 401, refresh once and try again. If that does not
    // work the session is over: tell the app so it can sign out cleanly.
    if (response.status === 401 && !noRefresh.has(path) && !refreshBlocked) {
        if (await refreshSession()) {
            response = await send(path, init);
        }
        if (response.status === 401) signalSessionEnded();
    }

    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
        if (
            response.status === 403 &&
            (body as { code?: string } | null)?.code === 'consent_required'
        ) {
            consentListeners.forEach((listener) => listener());
        }
        const retry = Number(response.headers.get('Retry-After'));
        throw new ApiError(
            response.status,
            body,
            Number.isFinite(retry) && retry > 0 ? retry : undefined,
        );
    }
    return body as T;
}

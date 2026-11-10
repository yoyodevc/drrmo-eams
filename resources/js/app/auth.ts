// Who is signed in. Calls /api/me, /api/login and /api/logout (Core).
import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
    api,
    ApiError,
    blockRefresh,
    onConsentRequired,
    onSessionEnded,
} from '@/shared/api/client';

export interface Me {
    id: number;
    first_name: string;
    last_name: string;
    // First and last name together, for display.
    name: string;
    email: string;
    role: 'admin' | 'marshal' | 'volunteer' | 'coordinator' | null;
    team: string | null;
    team_name?: string | null;
    status: 'active' | 'inactive';
    // Role permissions plus grants in force that are not tied to one event.
    permissions: string[];
    // Every grant in force now, including ones for one event.
    grants?: {
        permission: string;
        event_id: number | null;
        event_title: string | null;
        ends_at: string;
    }[];
    consent: {
        privacy_notice: boolean;
        // True when they agreed to an older notice version.
        privacy_notice_outdated: boolean;
        location_tracking: boolean;
    };
    home: '/admin' | '/me';
}

const meKey = ['me'] as const;

// Other open tabs hear about sign in and sign out through this channel.
const channelName = 'drrmo-auth';

function broadcast(message: 'signed-out' | 'signed-in'): void {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(message);
    channel.close();
}

// Forget everything about the signed-in person. Every cached answer goes, not only "me", so data
// of one user can never flash on screen for the next one. The route guards then show the login page.
// queryClient.clear() would also drop the live "me" observer the guards listen to, so they would
// never notice. This empties the same data but keeps that one observer attached.
export function endSession(queryClient: QueryClient): void {
    void queryClient.cancelQueries();
    queryClient.getMutationCache().clear();
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] });
    queryClient.setQueryData(meKey, null);
}

// Watches for the session ending outside this component: a failed refresh, a sign out in another
// tab, or a page restored from the browser's back/forward cache. Mount it once, inside the providers.
export function useSessionWatcher(): void {
    const queryClient = useQueryClient();

    useEffect(() => {
        const stopSession = onSessionEnded(() => endSession(queryClient));
        // The privacy notice changed while the app was open. Ask /api/me again.
        const stopConsent = onConsentRequired(() => {
            void queryClient.invalidateQueries({ queryKey: meKey });
        });

        const channel =
            typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName);
        if (channel) {
            channel.onmessage = (event: MessageEvent) => {
                if (event.data === 'signed-out') {
                    blockRefresh(true);
                    endSession(queryClient);
                } else if (event.data === 'signed-in') {
                    blockRefresh(false);
                    void queryClient.invalidateQueries({ queryKey: meKey });
                }
            };
        }

        // Back button after sign out can show a page from the browser's memory. Check again.
        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) void queryClient.invalidateQueries({ queryKey: meKey });
        };
        window.addEventListener('pageshow', onPageShow);

        return () => {
            stopSession();
            stopConsent();
            channel?.close();
            window.removeEventListener('pageshow', onPageShow);
        };
    }, [queryClient]);
}

// Returns null when nobody is signed in (401).
async function fetchMe(): Promise<Me | null> {
    try {
        const body = await api<{ data: Me }>('/api/me');
        return body.data;
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
    }
}

export function useMe() {
    return useQuery({ queryKey: meKey, queryFn: fetchMe, staleTime: 60_000, retry: false });
}

// Asks for a reset link. The server answers the same way whether or not the email has an account.
export async function requestPasswordReset(email: string): Promise<string> {
    const body = await api<{ message: string }>('/api/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
    return body.message;
}

export interface NewPassword {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
}

// Sets a new password from the emailed link. The server then signs the account out everywhere.
export async function resetPassword(input: NewPassword): Promise<string> {
    const body = await api<{ message: string }>('/api/reset-password', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    return body.message;
}

export function useAuthActions() {
    const queryClient = useQueryClient();

    async function login(email: string, password: string): Promise<Me> {
        const body = await api<{ data: Me }>('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        blockRefresh(false);
        queryClient.setQueryData(meKey, body.data);
        broadcast('signed-in');
        return body.data;
    }

    // The one sign out path. Only a 401 or 419 means "already signed out". Any other failure
    // keeps the person signed in and is thrown, so the button can say so.
    async function logout(): Promise<void> {
        blockRefresh(true);
        try {
            await api('/api/logout', { method: 'POST' });
        } catch (error) {
            const ended =
                error instanceof ApiError && (error.status === 401 || error.status === 419);
            if (!ended) {
                blockRefresh(false);
                throw error;
            }
        }
        endSession(queryClient);
        broadcast('signed-out');
    }

    return { login, logout };
}

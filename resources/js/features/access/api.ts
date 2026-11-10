// Typed calls to the Access module: grants (S2.6, S2.7).
import { api } from '@/shared/api/client';

export type GrantStatus = 'active' | 'upcoming' | 'ended' | 'revoked';

export interface Grant {
    id: number;
    permission: { code: string; description: string };
    person: { id: number; name: string | null };
    event: { id: number; title: string } | null;
    starts_at: string;
    ends_at: string;
    reason: string;
    status: GrantStatus;
    granted_by: string | null;
    revoked_at: string | null;
    revoked_by: string | null;
}

export interface NewGrant {
    user_id: number;
    permission: string;
    event_id: number | null;
    // ISO 8601 with offset.
    starts_at: string;
    ends_at: string;
    reason: string;
}

// The permissions an admin can give. Plain words for the screens, codes for the server.
export const grantable = [
    { code: 'location.view', label: 'See the live map', needsEvent: false, maxDays: 7 },
    { code: 'reports.submit', label: 'Submit site reports', needsEvent: true, maxDays: null },
    { code: 'reports.view', label: 'Read site reports', needsEvent: false, maxDays: null },
] as const;

export function permissionLabel(code: string): string {
    return grantable.find((g) => g.code === code)?.label ?? code;
}

export async function listGrants(userId: number): Promise<Grant[]> {
    const body = await api<{ data: Grant[] }>(`/api/grants?user=${userId}`);
    return body.data;
}

export async function createGrant(input: NewGrant): Promise<Grant> {
    const body = await api<{ data: Grant }>('/api/grants', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    return body.data;
}

export async function revokeGrant(id: number): Promise<Grant> {
    const body = await api<{ data: Grant }>(`/api/grants/${id}/revoke`, { method: 'POST' });
    return body.data;
}

export async function myGrants(): Promise<Grant[]> {
    const body = await api<{ data: Grant[] }>('/api/me/grants');
    return body.data;
}

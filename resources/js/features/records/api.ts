// Calls the Records endpoint for the privacy notice. Needs a signed-in person.
import { api } from '@/shared/api/client';

export async function agreeToPrivacyNotice(): Promise<void> {
    await api('/api/consent/privacy-notice', { method: 'POST' });
}

export async function agreeToLocationConsent(): Promise<void> {
    await api('/api/consent/location', { method: 'POST' });
}

export async function withdrawLocationConsent(): Promise<void> {
    await api('/api/consent/location', { method: 'DELETE' });
}

export interface AuditRow {
    id: number;
    action: string;
    entity: string;
    entity_id: number | null;
    meta: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
    actor: { id: number; name: string; email: string } | null;
}

export interface AuditFilters {
    actor: string;
    action: string;
    entity: string;
    from: string;
    to: string;
    page: number;
}

export interface AuditPage {
    data: AuditRow[];
    meta: { current_page: number; last_page: number; total: number };
    entities: string[];
}

export async function listAuditLogs(f: AuditFilters): Promise<AuditPage> {
    const query = new URLSearchParams();
    for (const key of ['actor', 'action', 'entity', 'from', 'to'] as const) {
        if (f[key]) query.set(key, f[key]);
    }
    if (f.page > 1) query.set('page', String(f.page));
    const qs = query.toString();
    return api<AuditPage>(`/api/audit-logs${qs ? `?${qs}` : ''}`);
}

// Typed calls to the Notifications module endpoints.
import { api } from '@/shared/api/client';

export type NotificationStatus = 'queued' | 'sent' | 'failed';

export interface NotificationRow {
    id: number;
    type: string;
    status: NotificationStatus;
    attempts: number;
    last_error: string | null;
    created_at: string | null;
    sent_at: string | null;
    recipient: { name: string; email: string } | null;
    event: string | null;
    // The person a notice is about, when it is not about an event.
    about?: string | null;
}

export interface NotificationFilters {
    type: string;
    status: string;
    from: string;
    to: string;
    search: string;
    page: number;
}

export interface NotificationPage {
    data: NotificationRow[];
    meta: { current_page: number; last_page: number; total: number };
    summary: { sent_today: number; daily_limit: number };
}

export async function listNotifications(f: NotificationFilters): Promise<NotificationPage> {
    const query = new URLSearchParams();
    for (const key of ['type', 'status', 'from', 'to', 'search'] as const) {
        if (f[key]) query.set(key, f[key]);
    }
    if (f.page > 1) query.set('page', String(f.page));
    const qs = query.toString();
    return api<NotificationPage>(`/api/notifications${qs ? `?${qs}` : ''}`);
}

export async function retryNotification(id: number): Promise<void> {
    await api(`/api/notifications/${id}/retry`, { method: 'POST' });
}

export interface MyNotification {
    id: number;
    type: string;
    sent_at: string | null;
    event: string | null;
    assignment_id: number | null;
}

export async function listMyNotifications(): Promise<MyNotification[]> {
    const body = await api<{ data: MyNotification[] }>('/api/me/notifications');
    return body.data;
}

// In app alerts. Today they carry emergencies. Always the signed in person's own.
export interface InAppAlert {
    id: number;
    type: string;
    emergency_report_id: number | null;
    site_report_id: number | null;
    event: string | null;
    due_at: string | null;
    about: string | null;
    created_at: string;
    read: boolean;
}

export async function listAlerts(): Promise<{ data: InAppAlert[]; unread: number }> {
    return api<{ data: InAppAlert[]; unread: number }>('/api/me/alerts');
}

export async function markAlertsRead(): Promise<void> {
    await api('/api/me/alerts/read', { method: 'POST' });
}

// Push alerts and alert settings. Always the signed in person's own.
export interface AlertSettings {
    sound_muted: boolean;
    push_muted: boolean;
    quiet_start: string | null;
    quiet_end: string | null;
}

export interface PushDevice {
    id: number;
    label: string | null;
    last_used_at: string | null;
    endpoint_hash: string;
}

export interface PushOverview {
    public_key: string | null;
    devices: PushDevice[];
    settings: AlertSettings;
}

export async function getPushOverview(): Promise<PushOverview> {
    const body = await api<{ data: PushOverview }>('/api/me/push');
    return body.data;
}

export async function saveAlertSettings(patch: Partial<AlertSettings>): Promise<AlertSettings> {
    const body = await api<{ data: AlertSettings }>('/api/me/alert-settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
    });
    return body.data;
}

export async function subscribePush(sub: PushSubscriptionJSON, label: string): Promise<void> {
    await api('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, label }),
    });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
    await api('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
}

export async function removePushDevice(id: number): Promise<void> {
    await api(`/api/push/devices/${id}`, { method: 'DELETE' });
}

export async function sendPushTest(): Promise<number> {
    const body = await api<{ data: { sent: number } }>('/api/push/test', { method: 'POST' });
    return body.data.sent;
}

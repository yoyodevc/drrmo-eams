// Calls for the admin volunteer availability screen (Personnel module).
import { api } from '@/shared/api/client';

export type Availability = 'active' | 'inactive';

export interface Volunteer {
    id: number;
    name: string;
    email: string;
    status: Availability;
}

export interface StatusChange {
    id: number;
    old_status: Availability;
    new_status: Availability;
    reason: string;
    changed_by: string | null;
    changed_at: string | null;
}

export async function listVolunteers(status: Availability | 'all'): Promise<Volunteer[]> {
    const query = status === 'all' ? '' : `?status=${status}`;
    const body = await api<{ data: Volunteer[] }>(`/api/admin/volunteers${query}`);
    return body.data;
}

export async function setVolunteerStatus(
    id: number,
    status: Availability,
    reason: string,
): Promise<void> {
    await api(`/api/admin/volunteers/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason }),
    });
}

export async function statusHistory(id: number): Promise<StatusChange[]> {
    const body = await api<{ data: StatusChange[] }>(`/api/admin/volunteers/${id}/status-history`);
    return body.data;
}

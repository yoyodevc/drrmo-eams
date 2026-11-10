// Calls for volunteer availability: the admin switch on a profile and the volunteer's own view.
import { api } from '@/shared/api/client';

export type Availability = 'active' | 'inactive';

export interface StatusChange {
    id: number;
    old_status: Availability;
    new_status: Availability;
    reason: string;
    changed_by: string | null;
    changed_at: string | null;
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

export interface MyAvailability {
    status: Availability;
    history: StatusChange[];
}

export async function myAvailability(): Promise<MyAvailability> {
    const body = await api<{ data: MyAvailability }>('/api/me/availability');
    return body.data;
}

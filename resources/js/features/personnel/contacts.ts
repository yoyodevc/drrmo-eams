// Calls for emergency contacts (Personnel module, S2.3).
import { api } from '@/shared/api/client';

export interface EmergencyContact {
    id: number;
    name: string;
    relationship: string;
    phone: string;
}

export type ContactInput = Omit<EmergencyContact, 'id'>;

export const MAX_CONTACTS = 5;

export async function myContacts(): Promise<EmergencyContact[]> {
    const body = await api<{ data: EmergencyContact[] }>('/api/me/emergency-contacts');
    return body.data;
}

export async function saveContact(id: number | null, input: ContactInput): Promise<void> {
    await api(id === null ? '/api/me/emergency-contacts' : `/api/me/emergency-contacts/${id}`, {
        method: id === null ? 'POST' : 'PUT',
        body: JSON.stringify(input),
    });
}

export async function deleteContact(id: number): Promise<void> {
    await api(`/api/me/emergency-contacts/${id}`, { method: 'DELETE' });
}

export async function personContacts(userId: number): Promise<EmergencyContact[]> {
    const body = await api<{ data: EmergencyContact[] }>(
        `/api/admin/people/${userId}/emergency-contacts`,
    );
    return body.data;
}

// Emergencies written while the phone has no signal wait here until they can go out. Kept in
// localStorage so a reload does not lose them. Each one has a client id, so sending it twice
// (a slow reply, then a retry) saves it once on the server. No React in here, so it is easy to test.
import type { EmergencyType } from './api';

export interface QueuedEmergency {
    client_id: string;
    assignment_id: string;
    type: EmergencyType;
    note: string;
    // A data URL of the resized photo, or null. Dropped first when the storage is full.
    photo: string | null;
    queued_at: string;
}

const KEY = 'drrmo.emergencies.queue';
// Emergencies are rare. The cap only stops a runaway loop from filling the storage.
export const MAX_QUEUED = 20;

export function newClientId(): string {
    return crypto.randomUUID();
}

export function readEmergencyQueue(): QueuedEmergency[] {
    try {
        const raw = localStorage.getItem(KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? (parsed as QueuedEmergency[]) : [];
    } catch {
        return [];
    }
}

function write(items: QueuedEmergency[]): boolean {
    try {
        if (items.length === 0) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, JSON.stringify(items));
        return true;
    } catch {
        return false;
    }
}

export function enqueueEmergency(item: QueuedEmergency): void {
    const next = [
        ...readEmergencyQueue().filter((q) => q.client_id !== item.client_id),
        item,
    ].slice(-MAX_QUEUED);
    // Storage full: keep the words and the type, give up the photo.
    if (!write(next)) write([...next.slice(0, -1), { ...item, photo: null }]);
}

export function removeQueuedEmergency(clientId: string): void {
    write(readEmergencyQueue().filter((q) => q.client_id !== clientId));
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
    return (await fetch(url)).blob();
}

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the photo.'));
        reader.readAsDataURL(blob);
    });
}

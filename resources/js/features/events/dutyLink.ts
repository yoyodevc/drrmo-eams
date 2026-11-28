// Emails link to the duties page with ?assignment=<code>. These helpers read that code and say where
// the matching duty sits, so the page can scroll to it and highlight it.
import type { MyAssignment } from '@/features/events/api';

/** The assignment's public code from a link, or null when it is missing or not a code. */
export function linkedAssignmentId(value: string | null): string | null {
    return value !== null && /^[a-z][a-z0-9]{15}$/.test(value) ? value : null;
}

export type LinkedDuty = { duty: MyAssignment; cancelled: boolean };

/** Finds the linked duty among the person's own duties. Someone else's id finds nothing. */
export function findLinkedDuty(duties: MyAssignment[], id: string | null): LinkedDuty | null {
    if (id === null) return null;
    const duty = duties.find((d) => d.id === id);
    if (!duty) return null;
    return { duty, cancelled: duty.event.status === 'cancelled' };
}

/**
 * Keeps ?assignment=<code> when a person is sent from one page to another (sign in, home redirect).
 * Only the duties page (/me) uses it, so every other path comes back unchanged.
 */
export function keepLinkedAssignment(path: string, search: string): string {
    if (path !== '/me') return path;
    const id = linkedAssignmentId(new URLSearchParams(search).get('assignment'));
    return id === null ? path : `${path}?assignment=${id}`;
}

/** Path to the login page that remembers the linked assignment. */
export function loginPathFor(search: string): string {
    const id = linkedAssignmentId(new URLSearchParams(search).get('assignment'));
    return id === null ? '/login' : `/login?assignment=${id}`;
}

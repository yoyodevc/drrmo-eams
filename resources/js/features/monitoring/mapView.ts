// Pure helpers for the live map (S4.3). No React or Leaflet in here so they are easy to test.
import type { MapPerson, MapState } from './api';

// Centre of the ZPPSU campus.
export const CAMPUS_CENTER: [number, number] = [6.91212, 122.05909];

export const POLL_MS = 30_000;

export const pinColors: Record<MapState, string> = {
    live: '#15803d',
    stale: '#78716c',
    none: '#78716c',
};

// "just now", "3 min ago", "2 h ago". Used for the last seen time next to a person.
export function lastSeen(capturedAt: string, now: number): string {
    const seconds = Math.max(0, Math.round((now - new Date(capturedAt).getTime()) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} h ago`;
}

// The map shows everyone who has a ping. "No ping 5+ min" and "No location" are side lists.
export function splitPeople(people: MapPerson[]) {
    return {
        onMap: people.filter((p) => p.ping !== null),
        stale: people.filter((p) => p.state === 'stale'),
        none: people.filter((p) => p.state === 'none'),
    };
}

// Events that have someone on duty, for the filter. Taken from the response so a person who holds
// only `location.view` does not need the events permission.
export function eventOptions(people: MapPerson[]): { id: number; title: string }[] {
    const seen = new Map<number, string>();
    for (const p of people) seen.set(p.event_id, p.event_title ?? `Event ${p.event_id}`);
    return [...seen]
        .map(([id, title]) => ({ id, title }))
        .sort((a, b) => a.title.localeCompare(b.title));
}

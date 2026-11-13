// Points captured on the phone wait here until the server has them. Kept in localStorage so a
// reload or a dead signal does not lose them. Uploads go out in batches of up to 50 (S4.2).
import type { PingPoint } from './api';

export const BATCH_SIZE = 50;
// Hard cap so a phone offline all day cannot fill its storage. Oldest points go first.
export const MAX_QUEUED = 1000;

const key = (assignmentId: number) => `drrmo.pings.${assignmentId}`;

export function readQueue(assignmentId: number): PingPoint[] {
    try {
        const raw = localStorage.getItem(key(assignmentId));
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? (parsed as PingPoint[]) : [];
    } catch {
        return [];
    }
}

function write(assignmentId: number, points: PingPoint[]): void {
    try {
        if (points.length === 0) localStorage.removeItem(key(assignmentId));
        else localStorage.setItem(key(assignmentId), JSON.stringify(points));
    } catch {
        // Storage full or blocked: tracking continues, only the offline backup is lost.
    }
}

export function enqueue(assignmentId: number, point: PingPoint): number {
    const next = [...readQueue(assignmentId), point].slice(-MAX_QUEUED);
    write(assignmentId, next);
    return next.length;
}

export function nextBatch(assignmentId: number): PingPoint[] {
    return readQueue(assignmentId).slice(0, BATCH_SIZE);
}

/** Drop the first `count` points, which the server has taken (or refused for good). */
export function dropSent(assignmentId: number, count: number): number {
    const rest = readQueue(assignmentId).slice(count);
    write(assignmentId, rest);
    return rest.length;
}

export function clearQueue(assignmentId: number): void {
    write(assignmentId, []);
}

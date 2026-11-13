// Labels and chips for the notification log.
import type { NotificationStatus } from './api';

export const typeLabels: Record<string, string> = {
    'assignment.created': 'Assigned',
    'assignment.changed': 'Changed',
    'assignment.cancelled': 'Cancelled',
    'reminder.evening': 'Reminder (evening)',
    'reminder.hour': 'Reminder (1 hour)',
    'consent.withdrawn': 'Location consent withdrawn',
};

export const statusChips: Record<NotificationStatus, { label: string; chip: string }> = {
    queued: { label: 'Queued', chip: 'bg-amber-50 text-amber-900 ring-amber-200' },
    sent: { label: 'Sent', chip: 'bg-green-50 text-green-800 ring-green-200' },
    failed: { label: 'Failed', chip: 'bg-red-50 text-red-800 ring-red-200' },
};

const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

export function when(iso: string | null): string {
    return iso ? stamp.format(new Date(iso)) : 'Not yet';
}

// 'ok' under 80% of the limit, 'near' from 80%, 'over' at or past it.
export function usageLevel(sent: number, limit: number): 'ok' | 'near' | 'over' {
    if (limit <= 0) return 'ok';
    if (sent >= limit) return 'over';
    return sent / limit >= 0.8 ? 'near' : 'ok';
}

export const typeSentences: Record<string, string> = {
    'assignment.created': 'You were assigned to a duty',
    'assignment.changed': 'Your duty was changed',
    'assignment.cancelled': 'Your duty was cancelled',
    'reminder.evening': 'Your duty is tomorrow',
    'reminder.hour': 'Your duty starts in 1 hour',
};

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
});

export function clock(iso: string | null): string {
    return iso ? clockFormat.format(new Date(iso)) : '';
}

// "Today", "Yesterday", or a day such as "Monday, Nov 2", in the browser's time zone.
export function dayLabel(date: Date, now: Date): string {
    const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((start(now) - start(date)) / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return dayFormat.format(date);
}

// Splits a newest first list into day groups, keeping the order. Items with no time go last.
export function groupByDay<T extends { sent_at: string | null }>(
    items: T[],
    now: Date = new Date(),
): { label: string; items: T[] }[] {
    const groups: { label: string; items: T[] }[] = [];
    const undated: T[] = [];
    for (const item of items) {
        if (!item.sent_at) {
            undated.push(item);
            continue;
        }
        const label = dayLabel(new Date(item.sent_at), now);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(item);
        else groups.push({ label, items: [item] });
    }
    if (undated.length > 0) groups.push({ label: 'Earlier', items: undated });
    return groups;
}

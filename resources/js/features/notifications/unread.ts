// Red dot on the Alerts tab. An alert is unread when it was sent after the last time
// this person opened the Alerts page. The "seen" time is kept in this browser only.
import { useQuery } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { useMe } from '@/app/auth';
import { listMyNotifications, type MyNotification } from './api';

const event = 'eams-alerts-seen';

function key(userId: string): string {
    return `eams.alerts.seen.${userId}`;
}

export function hasUnread(items: MyNotification[], seenAt: number): boolean {
    return items.some((n) => n.sent_at !== null && new Date(n.sent_at).getTime() > seenAt);
}

function readSeen(userId: string | undefined): number {
    if (userId === undefined) return Number.MAX_SAFE_INTEGER;
    try {
        return Number(localStorage.getItem(key(userId))) || 0;
    } catch {
        return 0;
    }
}

function subscribe(callback: () => void): () => void {
    window.addEventListener(event, callback);
    window.addEventListener('storage', callback);
    return () => {
        window.removeEventListener(event, callback);
        window.removeEventListener('storage', callback);
    };
}

export function useAlerts() {
    const me = useMe();
    const userId = me.data?.id;
    const seenAt = useSyncExternalStore(
        subscribe,
        () => readSeen(userId),
        () => Number.MAX_SAFE_INTEGER,
    );
    const list = useQuery({
        queryKey: ['my-notifications'],
        queryFn: listMyNotifications,
        enabled: userId !== undefined,
        refetchInterval: 60_000,
    });

    const markSeen = useCallback(() => {
        if (userId === undefined) return;
        try {
            localStorage.setItem(key(userId), String(Date.now()));
        } catch {
            // Private mode: the dot simply comes back on the next load.
        }
        window.dispatchEvent(new Event(event));
    }, [userId]);

    return { list, markSeen, seenAt, unread: list.data ? hasUnread(list.data, seenAt) : false };
}

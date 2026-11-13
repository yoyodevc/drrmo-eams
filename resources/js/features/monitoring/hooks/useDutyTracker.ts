// Sends a location point about every 30 seconds while the person is on duty and the page is
// open. Points wait in a local queue and upload in batches. Keeps the screen awake with the
// Screen Wake Lock API and asks for it again when the page becomes visible (S4.2).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { type PingPoint, uploadPings } from '../api';
import { dropSent, enqueue, nextBatch, readQueue } from '../pingQueue';

export const PING_INTERVAL_MS = 30_000;

export type TrackerState = 'sharing' | 'gps_off' | 'offline' | 'stopped';

export type DutyTracker = { state: TrackerState; pending: number };

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

export function useDutyTracker(assignmentId: number, active: boolean): DutyTracker {
    const [state, setState] = useState<TrackerState>('stopped');
    const [pending, setPending] = useState(() => readQueue(assignmentId).length);
    const flushing = useRef(false);

    // Upload queued points, one batch at a time, until the queue is empty or a call fails.
    const flush = useCallback(async () => {
        if (flushing.current || !navigator.onLine) return;
        flushing.current = true;
        try {
            for (
                let batch = nextBatch(assignmentId);
                batch.length > 0;
                batch = nextBatch(assignmentId)
            ) {
                try {
                    await uploadPings(assignmentId, batch);
                } catch (error) {
                    // The server refused these points for good (outside the window, no consent):
                    // drop them so one bad batch cannot block the queue. Anything else retries later.
                    if (error instanceof ApiError && [403, 422].includes(error.status)) {
                        setPending(dropSent(assignmentId, batch.length));
                        continue;
                    }
                    break;
                }
                setPending(dropSent(assignmentId, batch.length));
            }
        } finally {
            flushing.current = false;
        }
    }, [assignmentId]);

    useEffect(() => {
        if (!active) return;
        let stopped = false;
        let gpsOff = false;

        const refreshState = () =>
            setState(gpsOff ? 'gps_off' : navigator.onLine ? 'sharing' : 'offline');

        const capture = () => {
            if (!('geolocation' in navigator)) {
                gpsOff = true;
                refreshState();
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (stopped) return;
                    gpsOff = false;
                    const point: PingPoint = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy_m: Number.isFinite(position.coords.accuracy)
                            ? Math.round(position.coords.accuracy)
                            : null,
                        captured_at: new Date(position.timestamp).toISOString(),
                    };
                    setPending(enqueue(assignmentId, point));
                    refreshState();
                    void flush();
                },
                () => {
                    if (stopped) return;
                    gpsOff = true;
                    refreshState();
                },
                { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
            );
        };

        // Screen Wake Lock: released by the browser whenever the page is hidden, so ask again.
        let lock: WakeLockSentinelLike | null = null;
        const requestLock = async () => {
            const wake = (navigator as unknown as WakeLockNavigator).wakeLock;
            if (!wake || lock || document.visibilityState !== 'visible') return;
            try {
                lock = await wake.request('screen');
            } catch {
                lock = null; // Battery saver or no support: pings still run while the page is open.
            }
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                lock = null; // The old lock is gone once the page was hidden.
                void requestLock();
                capture();
            }
        };
        const onOnline = () => {
            refreshState();
            void flush();
        };
        const onOffline = refreshState;

        capture();
        void flush();
        void requestLock();
        const timer = window.setInterval(capture, PING_INTERVAL_MS);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        return () => {
            stopped = true;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            void lock?.release().catch(() => undefined);
            void flush(); // Leftover points still reach the server after duty ends.
            setState('stopped');
        };
    }, [active, assignmentId, flush]);

    return { state: active ? state : 'stopped', pending };
}

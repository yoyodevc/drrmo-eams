// Sends a location point about every 30 seconds while the person is on duty and the page is
// open. Points wait in a local queue and upload in batches. Keeps the screen awake with the
// Screen Wake Lock API and asks for it again when the page becomes visible (S4.2).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { type PingPoint, uploadPings } from '../api';
import { dropSent, enqueue, nextBatch, readQueue } from '../pingQueue';

export const PING_INTERVAL_MS = 30_000;

export type TrackerState = 'sharing' | 'gps_off' | 'offline' | 'stopped';

// Screen Wake Lock: active (screen stays on), unsupported (no API, or not https), denied (the
// browser said no, for example battery saver), released (the browser let go, usually page hidden).
export type WakeLockState = 'active' | 'unsupported' | 'denied' | 'released';

export type DutyTracker = { state: TrackerState; pending: number; wakeLock: WakeLockState };

type WakeLockSentinelLike = {
    release: () => Promise<void>;
    addEventListener?: (type: 'release', listener: () => void) => void;
};
type WakeLockNavigator = {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

export function useDutyTracker(assignmentId: number, active: boolean): DutyTracker {
    const [state, setState] = useState<TrackerState>('stopped');
    const [pending, setPending] = useState(() => readQueue(assignmentId).length);
    const [wakeLock, setWakeLock] = useState<WakeLockState>('released');
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
            if (!wake) {
                setWakeLock('unsupported');
                return;
            }
            if (lock || document.visibilityState !== 'visible') return;
            try {
                const sentinel = await wake.request('screen');
                if (stopped) {
                    void sentinel.release().catch(() => undefined);
                    return;
                }
                lock = sentinel;
                setWakeLock('active');
                sentinel.addEventListener?.('release', () => {
                    if (lock === sentinel) lock = null;
                    if (!stopped) setWakeLock('released');
                });
            } catch {
                lock = null; // Battery saver or blocked: pings still run while the page is open.
                if (!stopped) setWakeLock('denied');
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

    return { state: active ? state : 'stopped', pending, wakeLock };
}

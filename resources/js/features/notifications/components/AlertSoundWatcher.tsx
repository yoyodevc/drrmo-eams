// Plays the alert sounds while the app is open. Mounted once in each layout.
//  - Urgent (emergencies, missed reports): a repeating alarm and a full screen card until the person
//    taps Acknowledge or Dismiss. Plays even when sound is muted, because the owner decided emergencies
//    are never silenced.
//  - Important (assignments, due or overdue reports): one short chime, unless sound is muted.
//  - Normal: silent.
// Sound needs one tap on the page first. A banner asks for it, and any tap on the page also does it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { getPushOverview, markAlertsRead } from '../api';
import { alertLine } from '../alertLine';
import { inAppAlertsKey, useInAppAlerts } from '../useInAppAlerts';
import {
    isUnlocked,
    playChime,
    startAlarm,
    stopAlarm,
    preloadSounds,
    subscribeSound,
    unlock,
    urgencyOf,
} from '../sound';
import { restorePush } from '../push';
import { AlarmScreen } from './AlarmScreen';
import { SoundUnlockBanner } from './SoundUnlockBanner';

// An alert older than this is not "new" when the app opens, so it never wakes a person who is just looking.
const FRESH_MS = 10 * 60 * 1000;

export function AlertSoundWatcher({ to }: { to: string }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const alerts = useInAppAlerts();
    const settings = useQuery({
        queryKey: ['push-overview'],
        queryFn: getPushOverview,
        staleTime: 60_000,
    });
    const unlocked = useSyncExternalStore(subscribeSound, isUnlocked, () => false);
    const [openedAt] = useState(() => Date.now());
    const [dismissed, setDismissed] = useState<number[]>([]);
    const chimed = useRef<Set<number>>(new Set());
    const muted = settings.data?.settings.sound_muted ?? false;

    const read = useMutation({
        mutationFn: markAlertsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: inAppAlertsKey }),
    });

    const unread = (alerts.data?.data ?? []).filter((a) => !a.read);
    // Alerts that were already old when the app opened do not ring.
    const fresh = unread.filter((a) => new Date(a.created_at).getTime() > openedAt - FRESH_MS);
    const ringing = fresh.filter(
        (a) => urgencyOf(a.type) === 'urgent' && !dismissed.includes(a.id),
    );
    const chimes = fresh.filter((a) => urgencyOf(a.type) === 'important').map((a) => a.id);
    const ringKey = ringing.map((a) => a.id).join(',');
    const chimeKey = chimes.join(',');

    // A real tap on the page allows sound, so the banner is only a reminder. iPhones count a finished
    // touch or a click, not a scroll, so keep listening until one of those works.
    useEffect(() => {
        if (unlocked) return;
        const tap = () => void unlock();
        window.addEventListener('touchend', tap);
        window.addEventListener('click', tap);
        return () => {
            window.removeEventListener('touchend', tap);
            window.removeEventListener('click', tap);
        };
    }, [unlocked]);

    // Fetch the two sound files now so a tap can play them at once (see sound.ts).
    useEffect(() => {
        void preloadSounds();
    }, []);

    // After the app opens, quietly restore alerts on this device if the person had them on before.
    const restored = useRef(false);
    useEffect(() => {
        const overview = settings.data;
        if (!overview || restored.current) return;
        restored.current = true;
        void restorePush(
            overview.public_key,
            overview.devices.map((d) => d.endpoint_hash),
        ).then((changed) => {
            if (changed) void queryClient.invalidateQueries({ queryKey: ['push-overview'] });
        });
    }, [settings.data, queryClient]);

    // A push arrived while the app is on screen: look for the alert now, not in 30 seconds.
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        const onMessage = (e: MessageEvent) => {
            if ((e.data as { type?: string } | null)?.type === 'eams-push') {
                void queryClient.invalidateQueries({ queryKey: inAppAlertsKey });
            }
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [queryClient]);

    // The alarm rings while an urgent alert waits. It restarts when the sound is unlocked mid alarm.
    useEffect(() => {
        if (ringKey === '') {
            stopAlarm();
            return;
        }
        startAlarm();
    }, [ringKey, unlocked]);

    useEffect(() => () => stopAlarm(), []);

    // One chime for each new important alert, never together with an alarm.
    useEffect(() => {
        const next = chimeKey === '' ? [] : chimeKey.split(',').map(Number);
        const isNew = next.filter((id) => !chimed.current.has(id));
        next.forEach((id) => chimed.current.add(id));
        if (isNew.length > 0 && ringKey === '' && !muted) playChime();
    }, [chimeKey, ringKey, muted]);

    function finish(open: boolean) {
        stopAlarm();
        setDismissed((ids) => [...ids, ...ringing.map((a) => a.id)]);
        read.mutate();
        if (open) void navigate(to);
    }

    const first = ringing[0];

    return (
        <>
            {!unlocked && !muted && <SoundUnlockBanner onTurnOn={() => void unlock()} />}
            {first && (
                <AlarmScreen
                    alerts={ringing.map((a) => ({ id: a.id, text: alertLine(a, to, to).text }))}
                    openLabel={alertLine(first, to, to).open}
                    onAcknowledge={() => finish(true)}
                    onDismiss={() => finish(false)}
                />
            )}
        </>
    );
}

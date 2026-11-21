// Alert settings: turn push alerts on for this device, test them, mute, quiet hours, and the list of
// devices. Used in both layouts. The browser asks for permission only after the tap on "Turn on".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
    getPushOverview,
    removePushDevice,
    saveAlertSettings,
    sendPushTest,
    type AlertSettings as Settings,
} from '../api';
import { currentSubscription, disablePush, enablePush, pushSupport } from '../push';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const clock = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Toggle({
    checked,
    onChange,
    label,
    hint,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    hint: string;
}) {
    return (
        <label className="flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-maroon-700"
            />
            <span className="min-w-0">
                <span className="block font-semibold text-stone-900">{label}</span>
                <span className="block text-sm text-pretty text-stone-600">{hint}</span>
            </span>
        </label>
    );
}

export function AlertSettings() {
    const queryClient = useQueryClient();
    const overview = useQuery({ queryKey: ['push-overview'], queryFn: getPushOverview });
    const support = pushSupport();
    const [thisDevice, setThisDevice] = useState<string | null>(null);
    const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(
        null,
    );
    const [busy, setBusy] = useState(false);
    const permission = typeof Notification === 'undefined' ? 'default' : Notification.permission;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['push-overview'] });

    useEffect(() => {
        if (support !== 'ready') return;
        const known = new Set((overview.data?.devices ?? []).map((d) => d.endpoint_hash));
        void currentSubscription().then(async (s) => {
            if (!s) return setThisDevice(null);
            // Only "on" when the server knows this device too.
            const bytes = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(s.endpoint),
            );
            const hash = Array.from(new Uint8Array(bytes), (b) =>
                b.toString(16).padStart(2, '0'),
            ).join('');
            setThisDevice(known.has(hash) ? s.endpoint : null);
        });
    }, [support, overview.data]);

    const save = useMutation({
        mutationFn: (patch: Partial<Settings>) => saveAlertSettings(patch),
        onSuccess: refresh,
    });
    const remove = useMutation({ mutationFn: removePushDevice, onSuccess: refresh });

    async function turnOn() {
        const key = overview.data?.public_key;
        if (!key) {
            setMessage({
                tone: 'error',
                text: 'Alerts are not set up on the server yet. Ask an administrator.',
            });
            return;
        }
        setBusy(true);
        setMessage(null);
        try {
            await enablePush(key);
            setMessage({ tone: 'success', text: 'Alerts are on for this device.' });
            await refresh();
        } catch (e) {
            setMessage({
                tone: 'error',
                text:
                    e instanceof Error && e.message === 'denied'
                        ? 'Alerts are blocked for this app. Allow notifications in your browser or phone settings, then try again.'
                        : 'Could not turn alerts on. Try again.',
            });
        } finally {
            setBusy(false);
        }
    }

    async function turnOff() {
        setBusy(true);
        setMessage(null);
        try {
            await disablePush();
            setThisDevice(null);
            await refresh();
        } catch {
            setMessage({ tone: 'error', text: 'Could not turn alerts off. Try again.' });
        } finally {
            setBusy(false);
        }
    }

    async function test() {
        setBusy(true);
        setMessage(null);
        try {
            const sent = await sendPushTest();
            setMessage(
                sent > 0
                    ? { tone: 'success', text: 'Test sent. It should arrive in a few seconds.' }
                    : { tone: 'error', text: 'No device could be reached. Turn alerts on again.' },
            );
        } catch {
            setMessage({ tone: 'error', text: 'Could not send the test. Try again.' });
        } finally {
            setBusy(false);
        }
    }

    const s = overview.data?.settings;
    const quietOn = Boolean(s?.quiet_start && s?.quiet_end);
    const devices = overview.data?.devices ?? [];
    const on = thisDevice !== null;

    return (
        <div className="mx-auto max-w-xl">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Alerts</h1>
            <p className="mt-1 text-pretty text-stone-600">
                Get a notification on your phone for emergencies, duty changes and reports, even
                when the app is closed.
            </p>

            {message && (
                <div className="mt-4">
                    <Alert tone={message.tone}>{message.text}</Alert>
                </div>
            )}

            <section
                className="mt-6 rounded-card bg-white p-4 ring-1 ring-stone-200"
                aria-labelledby="device-h"
            >
                <h2 id="device-h" className="font-semibold text-stone-900">
                    This device
                </h2>
                {support === 'install' && (
                    <div className="mt-2 text-sm text-stone-700">
                        <p className="font-medium">Add DRRMO EAMS to your Home Screen first.</p>
                        <ol className="mt-2 list-decimal space-y-1 pl-5">
                            <li>Tap the Share button in Safari.</li>
                            <li>Choose Add to Home Screen.</li>
                            <li>
                                Open DRRMO EAMS from the Home Screen and come back to this page.
                            </li>
                        </ol>
                    </div>
                )}
                {support === 'unsupported' && (
                    <p className="mt-2 text-sm text-stone-700">
                        This browser cannot get alerts. Use Chrome on Android, or install the app,
                        and open it on a secure (https) address.
                    </p>
                )}
                {support === 'ready' && (
                    <>
                        <p className="mt-2 text-sm text-stone-700">
                            {on
                                ? 'Alerts are on for this device.'
                                : 'Alerts are off. When you turn them on, your phone will ask for permission. We only send short notices like "Emergency reported" with no names or places.'}
                        </p>
                        {permission === 'denied' && !on && (
                            <p className="mt-2 text-sm font-medium text-red-800">
                                Notifications are blocked for this app. Allow them in your browser
                                or phone settings first.
                            </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                            {on ? (
                                <>
                                    <Button
                                        type="button"
                                        onClick={() => void test()}
                                        disabled={busy}
                                    >
                                        Send a test
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => void turnOff()}
                                        disabled={busy}
                                    >
                                        Turn off on this device
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={() => void turnOn()}
                                    disabled={busy || permission === 'denied'}
                                >
                                    Turn on alerts on this device
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </section>

            <section
                className="mt-4 overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
                aria-label="Sound and mute"
            >
                <ul className="divide-y divide-stone-100">
                    <li>
                        <Toggle
                            checked={s?.sound_muted ?? false}
                            onChange={(v) => save.mutate({ sound_muted: v })}
                            label="Mute alert sound"
                            hint="Silences the short chime in the app. An emergency alarm still rings."
                        />
                    </li>
                    <li>
                        <Toggle
                            checked={s?.push_muted ?? false}
                            onChange={(v) => save.mutate({ push_muted: v })}
                            label="Mute duty and report notifications"
                            hint="No phone notification for duty changes and report reminders. Emergencies still notify you."
                        />
                    </li>
                </ul>
            </section>

            <section
                className="mt-4 rounded-card bg-white p-4 ring-1 ring-stone-200"
                aria-labelledby="quiet-h"
            >
                <h2 id="quiet-h" className="font-semibold text-stone-900">
                    Quiet hours
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                    No phone notifications for duty changes and reports during these hours (Manila
                    time). <strong>Emergencies ignore quiet hours.</strong>
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm font-medium text-stone-800">
                    <input
                        type="checkbox"
                        className="size-5 accent-maroon-700"
                        checked={quietOn}
                        onChange={(e) =>
                            save.mutate(
                                e.target.checked
                                    ? { quiet_start: '22:00', quiet_end: '06:00' }
                                    : { quiet_start: null, quiet_end: null },
                            )
                        }
                    />
                    Use quiet hours
                </label>
                {quietOn && (
                    <div className="mt-3 flex items-center gap-3">
                        <label className="text-sm text-stone-700">
                            From
                            <input
                                type="time"
                                value={s?.quiet_start ?? ''}
                                onChange={(e) =>
                                    e.target.value && save.mutate({ quiet_start: e.target.value })
                                }
                                className="mt-1 block min-h-12 rounded-control border border-stone-300 px-3"
                            />
                        </label>
                        <label className="text-sm text-stone-700">
                            To
                            <input
                                type="time"
                                value={s?.quiet_end ?? ''}
                                onChange={(e) =>
                                    e.target.value && save.mutate({ quiet_end: e.target.value })
                                }
                                className="mt-1 block min-h-12 rounded-control border border-stone-300 px-3"
                            />
                        </label>
                    </div>
                )}
            </section>

            <section
                className="mt-4 rounded-card bg-white p-4 ring-1 ring-stone-200"
                aria-labelledby="devices-h"
            >
                <h2 id="devices-h" className="font-semibold text-stone-900">
                    Your devices
                </h2>
                {devices.length === 0 ? (
                    <p className="mt-1 text-sm text-stone-600">No device gets alerts yet.</p>
                ) : (
                    <ul className="mt-2 divide-y divide-stone-100">
                        {devices.map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                                <span className="min-w-0 text-sm">
                                    <span className="block font-medium text-stone-900">
                                        {d.label ?? 'Device'}
                                    </span>
                                    <span className="block text-stone-600">
                                        {d.last_used_at
                                            ? `Last alert ${clock.format(new Date(d.last_used_at))}`
                                            : 'No alert sent yet'}
                                    </span>
                                </span>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => remove.mutate(d.id)}
                                    disabled={remove.isPending}
                                >
                                    Remove
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

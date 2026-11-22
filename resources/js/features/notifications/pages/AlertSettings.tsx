// Alert settings: turn push alerts on for this device, test them, mute, quiet hours, and the list of
// devices. Used in both layouts: under Me on phones (mobile first at 360 px) and in the admin side
// (desktop first at 1280 px). From 1024 px each section puts its title on the left and its card on
// the right. The browser asks for permission only after the tap on "Turn on alerts".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import {
    getPushOverview,
    removePushDevice,
    saveAlertSettings,
    sendPushTest,
    type AlertSettings as Settings,
    type PushDevice,
    type PushOverview,
} from '../api';
import { currentSubscription, disablePush, enablePush, pushSupport } from '../push';
import { BackLink } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

const overviewKey = ['push-overview'] as const;
const eyebrow = 'text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase';
const card = 'rounded-card bg-white ring-1 ring-stone-200';
const clock = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});
const hourMinute = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

// "22:00" as "10:00 PM" (or "22:00", as the phone prefers).
function timeLabel(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    return hourMinute.format(new Date(2000, 0, 1, h, m));
}

async function sha256(text: string): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function Icon({ children, className = 'size-5' }: { children: ReactNode; className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

const icons = {
    bell: (
        <>
            <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
            <path d="M10 20a2 2 0 0 0 4 0" />
        </>
    ),
    bellOff: (
        <>
            <path d="M8.6 4.1A6 6 0 0 1 18 9c0 2.5.4 4.2 1 5.4M17 16.5H3.5S6 15 6 9c0-.6.1-1.2.2-1.7" />
            <path d="M10 20a2 2 0 0 0 4 0M3 3l18 18" />
        </>
    ),
    blocked: (
        <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="m6 6 12 12" />
        </>
    ),
    phone: (
        <>
            <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
            <path d="M11 18.5h2" />
        </>
    ),
    computer: (
        <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
        </>
    ),
    share: (
        <>
            <path d="M12 3.5v11M8 7.5l4-4 4 4" />
            <path d="M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5" />
        </>
    ),
    addSquare: (
        <>
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M12 8.5v7M8.5 12h7" />
        </>
    ),
    home: (
        <>
            <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" />
            <path d="M9.5 20.5v-6h5v6" />
        </>
    ),
    shield: (
        <>
            <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
            <path d="m9.5 12 1.8 1.8 3.2-3.3" />
        </>
    ),
};

type Tone = 'on' | 'off' | 'warn' | 'problem';

const chipTones: Record<Tone, string> = {
    on: 'bg-green-50 text-green-800 ring-green-200',
    off: 'bg-stone-100 text-stone-600 ring-stone-200',
    warn: 'bg-amber-50 text-amber-900 ring-amber-200',
    problem: 'bg-red-50 text-red-800 ring-red-200',
};

const iconTones: Record<Tone, string> = {
    on: 'border-stone-200 text-maroon-700',
    off: 'border-stone-200 text-stone-500',
    warn: 'border-stone-200 text-amber-800',
    problem: 'border-stone-200 text-red-700',
};

// One section. Phones: a small eyebrow over the card. From 1024 px: title and a short line on the
// left, the card on the right, sections split by hairlines like a settings page.
function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    const id = useId();
    return (
        <section
            aria-labelledby={id}
            className="mt-8 lg:mt-0 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:border-t lg:border-stone-200 lg:py-8"
        >
            <div>
                <h2
                    id={id}
                    className={`${eyebrow} lg:text-base lg:tracking-normal lg:text-stone-900 lg:normal-case`}
                >
                    {title}
                </h2>
                {description && (
                    <p className="mt-1 hidden text-sm text-pretty text-stone-600 lg:block">
                        {description}
                    </p>
                )}
            </div>
            <div className="mt-2 lg:mt-0">{children}</div>
        </section>
    );
}

// A whole row is the tap target (48 px or more). The switch itself is a native checkbox with the
// switch role, so it works with a keyboard and screen readers without extra code.
function SwitchRow({
    checked,
    onChange,
    label,
    hint,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    hint: ReactNode;
}) {
    return (
        <label className="flex min-h-16 cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-stone-50 md:px-5">
            <span className="min-w-0 flex-1">
                <span className="block font-semibold text-stone-900">{label}</span>
                <span className="mt-0.5 block text-sm text-pretty text-stone-600">{hint}</span>
            </span>
            <input
                type="checkbox"
                role="switch"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="peer sr-only"
            />
            <span
                aria-hidden="true"
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-stone-300 transition-colors duration-150 peer-checked:bg-maroon-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-maroon-600 after:size-5 after:translate-x-0.5 after:rounded-full after:bg-white after:shadow-sm after:ring-1 after:ring-black/5 after:transition-transform after:duration-150 peer-checked:after:translate-x-[22px]"
            />
        </label>
    );
}

function Skeleton() {
    return (
        <div aria-busy="true" className="mt-6 lg:mt-8">
            <p role="status" className="sr-only">
                Loading your alert settings...
            </p>
            <div aria-hidden="true" className="space-y-8 lg:space-y-10">
                <div className="h-44 animate-pulse rounded-card bg-stone-200 lg:ml-[17.5rem]" />
                <div className="h-36 animate-pulse rounded-card bg-stone-200 lg:ml-[17.5rem]" />
                <div className="h-28 animate-pulse rounded-card bg-stone-200 lg:ml-[17.5rem]" />
            </div>
        </div>
    );
}

interface DeviceState {
    tone: Tone;
    chip: string;
    icon: ReactNode;
    title: string;
    body: ReactNode;
}

// The iPhone has to install the app before it can get alerts. Three steps, each with the icon the
// person will see in Safari.
function InstallSteps() {
    const steps = [
        {
            icon: icons.share,
            text: 'In Safari, tap Share. If you do not see it, tap the three dots first.',
        },
        { icon: icons.addSquare, text: 'Scroll down and tap Add to Home Screen, then Add.' },
        { icon: icons.home, text: 'Open DRRMO EAMS from your Home Screen and come back here.' },
    ];
    return (
        <ol className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
            {steps.map((step, i) => (
                <li key={step.text} className="flex items-center gap-3 py-3">
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-stone-500 tabular-nums">
                        {i + 1}
                    </span>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <Icon>{step.icon}</Icon>
                    </span>
                    <span className="min-w-0 text-sm text-pretty text-stone-800">{step.text}</span>
                </li>
            ))}
        </ol>
    );
}

export function AlertSettings() {
    const queryClient = useQueryClient();
    const admin = useLocation().pathname.startsWith('/admin');
    const overview = useQuery({ queryKey: overviewKey, queryFn: getPushOverview });
    const support = pushSupport();
    // undefined while we still check, null when this device is not subscribed.
    const [thisDevice, setThisDevice] = useState<{ endpoint: string; hash: string } | null>();
    const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(
        null,
    );
    const [busy, setBusy] = useState<'on' | 'off' | 'test' | null>(null);
    const [saveError, setSaveError] = useState(false);
    const [removing, setRemoving] = useState<PushDevice | null>(null);
    const permission = typeof Notification === 'undefined' ? 'default' : Notification.permission;
    const refresh = () => queryClient.invalidateQueries({ queryKey: overviewKey });

    useEffect(() => {
        if (support !== 'ready' || !overview.data) return;
        const known = new Set(overview.data.devices.map((d) => d.endpoint_hash));
        let live = true;
        void currentSubscription().then(async (s) => {
            // Only "on" when the server knows this device too.
            const hash = s ? await sha256(s.endpoint) : null;
            if (live)
                setThisDevice(s && hash && known.has(hash) ? { endpoint: s.endpoint, hash } : null);
        });
        return () => {
            live = false;
        };
    }, [support, overview.data]);

    // Switches move at once. If the save fails, they move back and say so.
    const save = useMutation({
        mutationFn: (patch: Partial<Settings>) => saveAlertSettings(patch),
        onMutate: async (patch) => {
            setSaveError(false);
            await queryClient.cancelQueries({ queryKey: overviewKey });
            const before = queryClient.getQueryData<PushOverview>(overviewKey);
            if (before) {
                queryClient.setQueryData<PushOverview>(overviewKey, {
                    ...before,
                    settings: { ...before.settings, ...patch },
                });
            }
            return { before };
        },
        onError: (_e, _patch, context) => {
            if (context?.before) queryClient.setQueryData(overviewKey, context.before);
            setSaveError(true);
        },
        onSettled: refresh,
    });

    const remove = useMutation({
        mutationFn: removePushDevice,
        onSuccess: async () => {
            setRemoving(null);
            await refresh();
        },
    });

    async function turnOn() {
        const key = overview.data?.public_key;
        if (!key) return;
        setBusy('on');
        setMessage(null);
        try {
            await enablePush(key);
            setMessage({ tone: 'success', text: 'Alerts are on. Send a test to check.' });
            await refresh();
        } catch (e) {
            setMessage({
                tone: 'error',
                text:
                    e instanceof Error && e.message === 'denied'
                        ? 'Notifications are blocked for this app. Allow them in your browser or phone settings, then try again.'
                        : 'Could not turn alerts on. Check your connection and try again.',
            });
        } finally {
            setBusy(null);
        }
    }

    async function turnOff() {
        setBusy('off');
        setMessage(null);
        try {
            await disablePush();
            setThisDevice(null);
            setRemoving(null);
            await refresh();
        } catch {
            setMessage({
                tone: 'error',
                text: 'Could not turn alerts off. Check your connection and try again.',
            });
        } finally {
            setBusy(null);
        }
    }

    async function test() {
        setBusy('test');
        setMessage(null);
        try {
            const sent = await sendPushTest();
            setMessage(
                sent > 0
                    ? { tone: 'success', text: 'Test sent. It should arrive in a few seconds.' }
                    : {
                          tone: 'error',
                          text: 'No device could be reached. Turn alerts off and on again.',
                      },
            );
        } catch {
            setMessage({
                tone: 'error',
                text: 'Could not send the test. Check your connection and try again.',
            });
        } finally {
            setBusy(null);
        }
    }

    const data = overview.data;
    const s = data?.settings;
    const quietOn = Boolean(s?.quiet_start && s?.quiet_end);
    const devices = data?.devices ?? [];
    const on = Boolean(thisDevice);
    const checking = support === 'ready' && thisDevice === undefined;

    const privacyLine = (
        <span className="mt-2 flex gap-2 text-stone-600">
            <Icon className="mt-0.5 size-4 shrink-0 text-stone-500">{icons.shield}</Icon>
            <span>
                Alerts only say short things like &ldquo;Emergency reported&rdquo;. They never show
                names or places.
            </span>
        </span>
    );

    const state: DeviceState =
        support === 'install'
            ? {
                  tone: 'warn',
                  chip: 'One step first',
                  icon: icons.phone,
                  title: 'Add the app to your Home Screen',
                  body: 'On iPhone, alerts work only in the app you add to your Home Screen from Safari.',
              }
            : support === 'unsupported'
              ? {
                    tone: 'off',
                    chip: 'Not available',
                    icon: icons.bellOff,
                    title: 'This browser cannot get alerts',
                    body: 'Use Chrome on Android, or install the app, and open it on a secure (https) address.',
                }
              : on
                ? {
                      tone: 'on',
                      chip: 'On',
                      icon: icons.bell,
                      title: 'Alerts are on',
                      body: 'This device gets emergencies, duty changes and report reminders, even when the app is closed.',
                  }
                : permission === 'denied'
                  ? {
                        tone: 'problem',
                        chip: 'Blocked',
                        icon: icons.blocked,
                        title: 'Notifications are blocked',
                        body: 'This app is not allowed to show notifications. Allow them in your browser or phone settings, then check again.',
                    }
                  : !data?.public_key
                    ? {
                          tone: 'warn',
                          chip: 'Not ready',
                          icon: icons.bellOff,
                          title: 'Alerts are not set up yet',
                          body: 'The server cannot send alerts yet. Ask the DRRMO office.',
                      }
                    : {
                          tone: 'off',
                          chip: 'Off',
                          icon: icons.bellOff,
                          title: 'Alerts are off',
                          body: (
                              <>
                                  Turn them on to hear about emergencies, duty changes and reports,
                                  even when the app is closed. Your browser will ask for permission
                                  first.
                                  {privacyLine}
                              </>
                          ),
                      };

    const thisDeviceCard = checking ? (
        <div aria-hidden="true" className="h-44 animate-pulse rounded-card bg-stone-200" />
    ) : (
        <div className={`${card} p-4 md:p-6`}>
            <div className="flex items-start gap-3 md:gap-4">
                <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-control border md:size-12 ${iconTones[state.tone]}`}
                >
                    <Icon className="size-6">{state.icon}</Icon>
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <h3 className="text-lg font-semibold text-stone-900">{state.title}</h3>
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${chipTones[state.tone]}`}
                        >
                            {state.chip}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-pretty text-stone-700">{state.body}</p>
                </div>
            </div>

            {support === 'install' && <InstallSteps />}

            {message && (
                <div className="mt-4">
                    <Alert tone={message.tone}>{message.text}</Alert>
                </div>
            )}

            {support === 'ready' && (on || permission === 'denied' || data?.public_key) && (
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {on ? (
                        <>
                            <Button
                                className="sm:min-w-40"
                                loading={busy === 'test'}
                                disabled={busy !== null}
                                onClick={() => void test()}
                            >
                                {busy === 'test' ? 'Sending...' : 'Send a test'}
                            </Button>
                            <Button
                                variant="secondary"
                                loading={busy === 'off'}
                                disabled={busy !== null}
                                onClick={() => void turnOff()}
                            >
                                {busy === 'off' ? 'Turning off...' : 'Turn off on this device'}
                            </Button>
                        </>
                    ) : permission === 'denied' ? (
                        <Button variant="secondary" onClick={() => window.location.reload()}>
                            Check again
                        </Button>
                    ) : (
                        <Button
                            className="sm:min-w-56"
                            loading={busy === 'on'}
                            disabled={busy !== null}
                            onClick={() => void turnOn()}
                        >
                            {busy === 'on' ? 'Turning on...' : 'Turn on alerts'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="mx-auto max-w-2xl lg:max-w-5xl">
            {admin ? (
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
            ) : (
                <BackLink to="/me/profile">Me</BackLink>
            )}
            <h1
                className={`${admin ? 'mt-4' : 'mt-2'} text-2xl font-semibold tracking-tight text-stone-900`}
            >
                Alerts
            </h1>
            <p className="mt-1 max-w-xl text-base text-pretty text-stone-600">
                How DRRMO EAMS gets your attention on this device. Mute and quiet hours never
                silence an emergency.
            </p>

            {overview.isPending && <Skeleton />}

            {overview.isError && (
                <div className="mt-6 max-w-xl space-y-3">
                    <Alert tone="error">
                        Your alert settings did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={overview.isFetching}
                        onClick={() => void overview.refetch()}
                    >
                        {overview.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {data && s && (
                <div className="lg:mt-8 lg:[&>section:first-child]:border-t-0 lg:[&>section:first-child]:pt-0">
                    <Section
                        title="This device"
                        description="Alerts are turned on for each phone or computer on its own."
                    >
                        {thisDeviceCard}
                    </Section>

                    <Section
                        title="Sound and mute"
                        description="Turn down the everyday alerts. An emergency still rings and still notifies you."
                    >
                        {saveError && (
                            <div className="mb-3">
                                <Alert tone="error">
                                    Your change was not saved. Check your connection and try again.
                                </Alert>
                            </div>
                        )}
                        <ul className={`${card} divide-y divide-stone-100 overflow-hidden`}>
                            <li>
                                <SwitchRow
                                    checked={s.sound_muted}
                                    onChange={(v) => save.mutate({ sound_muted: v })}
                                    label="Mute alert sound"
                                    hint="No chime in the app for duty changes and reports. The emergency alarm still rings."
                                />
                            </li>
                            <li>
                                <SwitchRow
                                    checked={s.push_muted}
                                    onChange={(v) => save.mutate({ push_muted: v })}
                                    label="Mute duty and report notifications"
                                    hint="No phone notification for duty changes and report reminders. Emergencies still notify you."
                                />
                            </li>
                        </ul>
                    </Section>

                    <Section
                        title="Quiet hours"
                        description="A daily time when duty and report notifications wait. Times are in Manila time."
                    >
                        <div className={`${card} overflow-hidden`}>
                            <SwitchRow
                                checked={quietOn}
                                onChange={(next) =>
                                    save.mutate(
                                        next
                                            ? { quiet_start: '22:00', quiet_end: '06:00' }
                                            : { quiet_start: null, quiet_end: null },
                                    )
                                }
                                label="Use quiet hours"
                                hint={
                                    quietOn && s.quiet_start && s.quiet_end
                                        ? `No duty or report notifications from ${timeLabel(s.quiet_start)} to ${timeLabel(s.quiet_end)}, Manila time.`
                                        : 'For example, no duty or report notifications from 10 PM to 6 AM.'
                                }
                            />
                            {quietOn && (
                                <div className="grid grid-cols-1 gap-3 border-t border-stone-100 px-4 pt-3 pb-4 sm:grid-cols-2 md:px-5 lg:grid-cols-[repeat(2,minmax(0,13rem))]">
                                    {(
                                        [
                                            ['From', 'quiet_start'],
                                            ['To', 'quiet_end'],
                                        ] as const
                                    ).map(([label, field]) => (
                                        // iOS Safari gives time fields a fixed native width and centers
                                        // the value. min-w-0 and appearance-none let them fit.
                                        <label
                                            key={field}
                                            className="block min-w-0 text-sm font-medium text-stone-800"
                                        >
                                            {label}
                                            <input
                                                type="time"
                                                value={s[field] ?? ''}
                                                onChange={(e) =>
                                                    e.target.value &&
                                                    save.mutate({
                                                        [field]: e.target.value,
                                                    } as Partial<Settings>)
                                                }
                                                className="mt-1 block h-12 w-full max-w-full min-w-0 appearance-none rounded-control border border-stone-300 bg-white px-3 text-base text-stone-900 tabular-nums focus:border-maroon-600 focus:outline-2 focus:outline-offset-0 focus:outline-maroon-600/30 [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:leading-[2.875rem]"
                                            />
                                        </label>
                                    ))}
                                </div>
                            )}
                            <p className="flex gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3 text-sm text-pretty text-stone-700 md:px-5">
                                <Icon className="mt-0.5 size-4 shrink-0 text-maroon-700">
                                    {icons.shield}
                                </Icon>
                                <span>
                                    <strong className="font-semibold text-stone-900">
                                        Emergencies ignore quiet hours.
                                    </strong>{' '}
                                    You always get them, day or night.
                                </span>
                            </p>
                        </div>
                    </Section>

                    <Section
                        title="Your devices"
                        description="Every phone or computer that gets your alerts. Remove one you no longer use."
                    >
                        <div className={card}>
                            {devices.length === 0 ? (
                                <div className="flex items-start gap-3 p-4 md:p-5">
                                    <Icon className="mt-0.5 size-5 shrink-0 text-stone-400">
                                        {icons.phone}
                                    </Icon>
                                    <p className="text-sm text-pretty text-stone-600">
                                        No device gets your alerts yet.
                                        {support === 'ready' &&
                                            ' Turn alerts on above to add this one.'}
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-stone-100">
                                    {devices.map((d) => {
                                        const mine = thisDevice?.hash === d.endpoint_hash;
                                        const mobile = /Android|iPhone/.test(d.label ?? '');
                                        return (
                                            <li
                                                key={d.id}
                                                className="flex items-center gap-3 px-4 py-3 md:px-5"
                                            >
                                                <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-stone-200 text-stone-600">
                                                    <Icon>
                                                        {mobile ? icons.phone : icons.computer}
                                                    </Icon>
                                                </span>
                                                <span className="min-w-0 flex-1 text-sm">
                                                    <span className="block truncate text-base font-semibold text-stone-900">
                                                        {d.label ?? 'Device'}
                                                    </span>
                                                    <span className="block text-stone-600">
                                                        {mine && (
                                                            <span className="font-medium text-maroon-700">
                                                                This device.{' '}
                                                            </span>
                                                        )}
                                                        {d.last_used_at
                                                            ? `Last alert ${clock.format(new Date(d.last_used_at))}`
                                                            : 'No alert sent yet'}
                                                    </span>
                                                </span>
                                                <Button
                                                    variant="secondary"
                                                    size="md"
                                                    onClick={() => setRemoving(d)}
                                                    disabled={busy !== null}
                                                    aria-label={`Remove ${d.label ?? 'device'}`}
                                                >
                                                    Remove
                                                </Button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </Section>
                </div>
            )}

            <ConfirmDialog
                open={removing !== null}
                title="Remove this device?"
                description={
                    removing && thisDevice?.hash === removing.endpoint_hash
                        ? 'This phone or computer will stop getting alerts. You can turn them on again here at any time.'
                        : `${removing?.label ?? 'This device'} will stop getting alerts. To get them again, turn alerts on from that device.`
                }
                confirmLabel="Remove device"
                tone="danger"
                loading={remove.isPending || busy === 'off'}
                loadingLabel="Removing..."
                error={
                    remove.isError
                        ? 'Could not remove the device. Check your connection and try again.'
                        : null
                }
                onConfirm={() => {
                    if (!removing) return;
                    // Removing this device also drops it in the browser, same as Turn off.
                    if (thisDevice?.hash === removing.endpoint_hash) void turnOff();
                    else remove.mutate(removing.id);
                }}
                onCancel={() => {
                    setRemoving(null);
                    remove.reset();
                }}
            />
        </div>
    );
}

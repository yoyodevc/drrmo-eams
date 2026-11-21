// M-Notifications. The emails the system sent to this person, newest first, grouped by day.
// Mobile first at 360 px: one column, one card per day with hairline rows. Read only.
// The date is the first thing you see: each day opens with a calendar tile and its full date,
// even for Today and Yesterday. Rows keep a chevron sized slot, so the times form one column.
import { useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router';
import { useMe } from '@/app/auth';
import { useAlerts } from '../../unread';
import { clock, dayHeading, groupByDay, typeSentences } from '../../format';
import type { MyNotification } from '../../api';
import {
    AssignedIcon,
    BellIcon,
    CancelledIcon,
    ChangedIcon,
    ChevronRightIcon,
    ClockIcon,
    MailIcon,
} from '../../components/icons';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

type Kind = {
    icon: ComponentType<{ className?: string }>;
    tone: string;
    hint: string;
    open: boolean;
};

const kinds: Record<string, Kind> = {
    'assignment.created': {
        icon: AssignedIcon,
        tone: 'text-sky-700',
        hint: 'Acknowledge it in Duties if you have not yet.',
        open: true,
    },
    'assignment.changed': {
        icon: ChangedIcon,
        tone: 'text-amber-700',
        hint: 'Check the new time and place in Duties.',
        open: true,
    },
    'assignment.cancelled': {
        icon: CancelledIcon,
        tone: 'text-stone-500',
        hint: 'You do not need to report for it.',
        open: false,
    },
};
const reminder: Kind = {
    icon: ClockIcon,
    tone: 'text-maroon-700',
    hint: 'Check where to be and when in Duties.',
    open: true,
};
const fallback: Kind = { icon: MailIcon, tone: 'text-stone-500', hint: '', open: false };

function kindOf(type: string): Kind {
    return kinds[type] ?? (type.startsWith('reminder.') ? reminder : fallback);
}

function AlertRow({ alert, fresh }: { alert: MyNotification; fresh: boolean }) {
    const kind = kindOf(alert.type);
    const Icon = kind.icon;
    const body = (
        <>
            <span className={`mt-0.5 shrink-0 ${kind.tone}`} aria-hidden="true">
                <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-stone-900">
                        {typeSentences[alert.type] ?? 'Notification'}
                        {fresh && (
                            <>
                                <span
                                    className="ml-2 inline-block size-2 -translate-y-0.5 rounded-full bg-red-600"
                                    aria-hidden="true"
                                />
                                <span className="sr-only"> (new)</span>
                            </>
                        )}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-stone-700 tabular-nums">
                        {clock(alert.sent_at)}
                    </span>
                </span>
                {alert.event && (
                    <span className="mt-0.5 block text-pretty text-stone-700">{alert.event}</span>
                )}
                {kind.hint && (
                    <span className="mt-1 block text-sm text-pretty text-stone-600">
                        {kind.hint}
                    </span>
                )}
            </span>
        </>
    );

    return (
        <li>
            {kind.open ? (
                <Link
                    to="/me"
                    className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-stone-50 active:bg-stone-100"
                >
                    {body}
                    <ChevronRightIcon className="mt-0.5 size-5 shrink-0 text-stone-400" />
                </Link>
            ) : (
                <div className="flex gap-3 px-4 py-3.5">
                    {body}
                    {/* Same width as the chevron, so every time lines up on the right. */}
                    <span className="w-5 shrink-0" aria-hidden="true" />
                </div>
            )}
        </li>
    );
}

// A day opens with a calendar tile (month over day), then the day's name and its full date.
// Alerts with no send time land in "Earlier", which gets a plain heading.
function DayHeading({ id, sentAt, count }: { id: string; sentAt: string | null; count: number }) {
    const h = sentAt ? dayHeading(new Date(sentAt)) : null;
    return (
        <div className="flex items-center gap-3">
            {h && (
                <span
                    aria-hidden="true"
                    className="flex w-11 shrink-0 flex-col items-center rounded-control bg-white py-1 ring-1 ring-stone-200"
                >
                    <span className="text-[0.6875rem] leading-4 font-semibold tracking-wide text-maroon-700 uppercase">
                        {h.month}
                    </span>
                    <span className="text-lg leading-6 font-semibold text-stone-900 tabular-nums">
                        {h.day}
                    </span>
                </span>
            )}
            <h2 id={id} className="min-w-0 flex-1">
                <span className="block font-semibold text-stone-900">
                    {h ? h.title : 'Earlier'}
                </span>
                {h && <span className="block text-sm text-stone-600">{h.detail}</span>}
            </h2>
            <span className="shrink-0 text-sm text-stone-500 tabular-nums">
                {count === 1 ? '1 alert' : `${count} alerts`}
            </span>
        </div>
    );
}

function Skeleton() {
    return (
        <div className="mt-6" aria-busy="true">
            <p role="status" className="sr-only">
                Loading your alerts...
            </p>
            <div className="flex items-center gap-3" aria-hidden="true">
                <div className="h-12 w-11 animate-pulse rounded-control bg-stone-200" />
                <div className="space-y-2">
                    <div className="h-4 w-20 animate-pulse rounded bg-stone-200" />
                    <div className="h-3 w-32 animate-pulse rounded bg-stone-200" />
                </div>
            </div>
            <div
                className="mt-3 divide-y divide-stone-100 rounded-card bg-white ring-1 ring-stone-200"
                aria-hidden="true"
            >
                {[0, 1, 2].map((row) => (
                    <div key={row} className="flex gap-3 px-4 py-3.5">
                        <div className="mt-0.5 size-5 shrink-0 animate-pulse rounded bg-stone-200" />
                        <div className="flex-1 space-y-2.5">
                            <div className="h-4 w-3/5 animate-pulse rounded bg-stone-200" />
                            <div className="h-4 w-4/5 animate-pulse rounded bg-stone-200" />
                            <div className="h-3 w-2/5 animate-pulse rounded bg-stone-200" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function MyNotifications() {
    const me = useMe();
    const { list, markSeen, seenAt } = useAlerts();
    // Keep the "seen" time from when the page opened, so new alerts stay marked while you read.
    const [openedSeenAt] = useState(seenAt);
    // Opening the page counts as reading. Wait for the data so nothing new is hidden.
    useEffect(() => {
        if (list.isSuccess) markSeen();
    }, [list.isSuccess, list.dataUpdatedAt, markSeen]);

    const items = list.data ?? [];
    const groups = groupByDay(items);
    const isFresh = (n: MyNotification) =>
        n.sent_at !== null && new Date(n.sent_at).getTime() > openedSeenAt;
    const freshCount = items.filter(isFresh).length;

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Alerts</h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                Emails DRRMO sent you about your duties, newest first.
            </p>

            {list.isSuccess && freshCount > 0 && (
                <p className="mt-4 text-sm font-medium text-stone-700" aria-live="polite">
                    {freshCount === 1 ? '1 new alert' : `${freshCount} new alerts`} since your last
                    visit.
                </p>
            )}

            {list.isPending && <Skeleton />}

            {list.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        Your alerts did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={list.isFetching}
                        onClick={() => void list.refetch()}
                    >
                        {list.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {list.isSuccess && items.length === 0 && (
                <div className="mt-6 flex flex-col items-center rounded-card bg-white px-6 py-10 text-center ring-1 ring-stone-200 md:py-14">
                    <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <BellIcon className="size-5" />
                    </span>
                    <p className="mt-4 text-lg font-semibold text-stone-900">No alerts yet</p>
                    <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                        When DRRMO assigns you, changes or cancels a duty, the email shows up here
                        too.
                    </p>
                </div>
            )}

            {list.isSuccess &&
                groups.map((group) => {
                    const id = `alerts-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                    return (
                        <section key={group.label} aria-labelledby={id} className="mt-7">
                            <DayHeading
                                id={id}
                                sentAt={group.items[0].sent_at}
                                count={group.items.length}
                            />
                            <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                                {group.items.map((alert) => (
                                    <AlertRow key={alert.id} alert={alert} fresh={isFresh(alert)} />
                                ))}
                            </ul>
                        </section>
                    );
                })}

            {list.isSuccess && items.length > 0 && (
                <p className="mt-6 flex items-start gap-2 text-sm text-pretty text-stone-500">
                    <MailIcon className="mt-0.5 size-4 shrink-0" />
                    <span>
                        Each alert was also sent to {me.data?.email ?? 'your email'}. This list
                        keeps your last 50.
                    </span>
                </p>
            )}
        </div>
    );
}

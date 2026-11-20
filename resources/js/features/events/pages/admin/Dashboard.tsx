// A-Dashboard (S3.7). Today at a glance. Four counts on top, then the people who need a nudge,
// today's events and who is on duty, a system strip and statistics. Refreshes every minute.
// Phones: one column, the "needs attention" lists come first. Desktop: events on the left,
// people lists on the right. Lists switch layout by their own width (container queries).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
    getDashboard,
    markNoShow,
    type Dashboard as DashboardData,
    type DashboardRow,
} from '@/features/events/api';
import {
    AlertIcon,
    CalendarIcon,
    ChartIcon,
    CheckIcon,
    ChevronIcon,
    ClockIcon,
    PeopleIcon,
    PinIcon,
    RefreshIcon,
} from '@/features/events/components/icons';
import { chipClass } from '@/features/events/format';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

type TodayEvent = DashboardData['today_events'][number];

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const longDay = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
});

function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    return (
        (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
    ).toUpperCase();
}

// A time today reads "8:00 AM". Another day reads "Nov 9, 8:00 AM".
function when(iso: string) {
    const date = new Date(iso);
    return date.toDateString() === new Date().toDateString()
        ? time.format(date)
        : `${day.format(date)}, ${time.format(date)}`;
}

// "35 min late" or "1 h 10 min late".
function lateBy(iso: string, now: number) {
    const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
    if (minutes < 60) return `${minutes} min late`;
    const rest = minutes % 60;
    return `${Math.floor(minutes / 60)} h${rest > 0 ? ` ${rest} min` : ''} late`;
}

function isLive(event: TodayEvent, now: number) {
    return new Date(event.starts_at).getTime() <= now && now < new Date(event.ends_at).getTime();
}

function failMessage(failure: unknown): string {
    if (failure instanceof ApiError && failure.status === 422) {
        const body = failure.body as { message?: string } | null;
        return body?.message ?? 'That did not work. Refresh and try again.';
    }
    return 'That did not work. Check your connection and try again.';
}

function LiveDot({ pulse = false }: { pulse?: boolean }) {
    return (
        <span className="relative flex size-1.5 shrink-0" aria-hidden="true">
            {pulse && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember-500 opacity-60" />
            )}
            <span className="relative inline-flex size-1.5 rounded-full bg-ember-500" />
        </span>
    );
}

// One count in the top row. Two per row on phones, four on desktop.
function Stat({
    icon,
    label,
    value,
    note,
    tone = 'plain',
}: {
    icon: ReactNode;
    label: string;
    value: number;
    note: string;
    tone?: 'plain' | 'live' | 'urgent';
}) {
    return (
        <div
            className={`rounded-card bg-white p-4 ring-1 sm:p-5 ${tone === 'urgent' ? 'ring-ember-200' : 'ring-stone-200'}`}
        >
            <dt className="flex items-center gap-2 text-sm font-medium text-stone-600">
                <span className={tone === 'urgent' ? 'text-ember-700' : 'text-stone-500'}>
                    {icon}
                </span>
                <span className="leading-tight">{label}</span>
                {tone === 'live' && <LiveDot />}
            </dt>
            <dd
                className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${tone === 'urgent' ? 'text-ember-700' : 'text-stone-900'}`}
            >
                {value}
            </dd>
            <dd className="mt-0.5 text-xs text-pretty text-stone-500 sm:text-sm">{note}</dd>
        </div>
    );
}

function Panel({
    id,
    title,
    intro,
    count,
    action,
    children,
}: {
    id: string;
    title: string;
    intro: string;
    count?: number;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section
            aria-labelledby={id}
            className="@container overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
        >
            <header className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
                <div className="min-w-0">
                    <h2
                        id={id}
                        className="flex items-baseline gap-2 text-lg font-semibold text-stone-900"
                    >
                        {title}
                        {count !== undefined && (
                            <span className="text-sm font-normal text-stone-500 tabular-nums">
                                {count}
                            </span>
                        )}
                    </h2>
                    <p className="mt-0.5 text-sm text-pretty text-stone-600">{intro}</p>
                </div>
                {action}
            </header>
            {children}
        </section>
    );
}

function AllClear({ icon, text }: { icon: ReactNode; text: string }) {
    return (
        <p className="flex items-center gap-3 border-t border-stone-200 px-4 py-4 text-sm text-stone-600 sm:px-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-stone-200 text-stone-500">
                {icon}
            </span>
            {text}
        </p>
    );
}

// One person per row. In a narrow list the right side drops under the name, so names never
// get cut to a letter. From 448 px of list width it sits on the right.
function PeopleRows({
    rows,
    aside,
}: {
    rows: DashboardRow[];
    aside: (row: DashboardRow) => ReactNode;
}) {
    return (
        <ul className="divide-y divide-stone-100 border-t border-stone-200">
            {rows.map((row) => (
                <li
                    key={row.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 @md:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
                    <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-sm font-semibold text-maroon-800"
                        aria-hidden="true"
                    >
                        {initials(row.person)}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-medium text-stone-900">{row.person}</p>
                        <p className="truncate text-sm text-stone-600">
                            <Link
                                to={`/admin/events/${row.event.id}`}
                                className="text-maroon-700 hover:underline"
                            >
                                {row.event.title}
                            </Link>
                            {row.duty && <span className="text-stone-500"> · {row.duty}</span>}
                        </p>
                    </div>
                    <div className="col-start-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 @md:col-start-3 @md:flex-col @md:items-end @md:justify-center @md:text-right">
                        {aside(row)}
                    </div>
                </li>
            ))}
        </ul>
    );
}

// How full an event is. While it runs, the bar shows who is on duty. Before, who is assigned.
function Staffing({ event, live }: { event: TodayEvent; live: boolean }) {
    const total = event.places_needed > 0 ? event.places_needed : event.people_count;
    const filled = live ? event.on_duty_count : event.people_count;
    const share = total > 0 ? Math.min(1, filled / total) : 0;
    return (
        <div className="col-start-2 @lg:col-start-3 @lg:text-right">
            <p className="flex items-center gap-1.5 text-sm text-stone-600 tabular-nums @lg:justify-end">
                <PeopleIcon className="size-4 shrink-0 text-stone-500" />
                <span className="font-semibold text-stone-900">{filled}</span>
                <span>
                    of {total} {live ? 'on duty' : 'assigned'}
                </span>
            </p>
            <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-200"
                aria-hidden="true"
            >
                <div
                    className={`h-full rounded-full ${live ? 'bg-ember-500' : 'bg-maroon-700'}`}
                    style={{ width: `${share * 100}%` }}
                />
            </div>
        </div>
    );
}

function TodayEvents({ events, now }: { events: TodayEvent[]; now: number }) {
    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center border-t border-stone-200 px-6 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                    <CalendarIcon className="size-5" />
                </span>
                <p className="mt-3 font-medium text-stone-900">No published events today</p>
                <p className="mt-0.5 text-sm text-pretty text-stone-600">
                    Drafts do not show here until you publish them.
                </p>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-stone-100 border-t border-stone-200">
            {events.map((event) => {
                const live = isLive(event, now);
                const over = new Date(event.ends_at).getTime() <= now;
                return (
                    <li key={event.id}>
                        <Link
                            to={`/admin/events/${event.id}`}
                            className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-stone-50 sm:px-6 @lg:grid-cols-[5rem_minmax(0,1fr)_9rem] @lg:gap-x-5"
                        >
                            <div className="self-start text-sm tabular-nums">
                                <p className="font-semibold text-stone-900">
                                    {time.format(new Date(event.starts_at))}
                                </p>
                                <p className="text-stone-500">
                                    {time.format(new Date(event.ends_at))}
                                </p>
                            </div>
                            <div className="min-w-0">
                                <p
                                    className={`truncate font-semibold group-hover:text-maroon-700 ${over ? 'text-stone-500' : 'text-stone-900'}`}
                                >
                                    {event.title}
                                </p>
                                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-600">
                                    <PinIcon className="size-4 shrink-0 text-stone-500" />
                                    <span className="truncate">
                                        {event.location ?? 'No location set'}
                                    </span>
                                </p>
                                {(live || over) && (
                                    <p className="mt-1.5">
                                        {live ? (
                                            <span
                                                className={`${chipClass} gap-1.5 bg-ember-50 text-ember-700 ring-ember-200`}
                                            >
                                                <LiveDot />
                                                Happening now
                                            </span>
                                        ) : (
                                            <span
                                                className={`${chipClass} bg-stone-100 text-stone-600 ring-stone-200`}
                                            >
                                                Ended
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                            <Staffing event={event} live={live} />
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

// Statistics from the finished duties, and a strip of what needs attention in the other modules.
type Stats = DashboardData['stats'];

function StatCard({
    title,
    period,
    value,
    unit,
    children,
}: {
    title: string;
    period: string;
    value: string;
    unit: string;
    children: ReactNode;
}) {
    return (
        <article className="flex flex-col rounded-card bg-white p-4 ring-1 ring-stone-200 sm:p-5">
            <h3 className="text-sm font-medium text-stone-800">{title}</h3>
            <p className="text-xs text-stone-500">{period}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 tabular-nums">
                {value}
                <span className="ml-1 text-sm font-medium text-stone-500">{unit}</span>
            </p>
            <div className="mt-auto pt-4">{children}</div>
        </article>
    );
}

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
    const max = Math.max(...values, 1);
    return (
        <div className="flex h-16 items-end gap-1.5">
            {values.map((value, index) => (
                <span
                    key={labels[index]}
                    title={`${labels[index]}: ${value}`}
                    className="flex-1 rounded-t-sm bg-maroon-700"
                    style={{ height: `${Math.max(value > 0 ? 6 : 2, (value / max) * 100)}%` }}
                />
            ))}
        </div>
    );
}

function Split({ stats }: { stats: Stats['attendance'] }) {
    const parts = [
        { label: 'On time', n: stats.on_time, bar: 'bg-green-600' },
        { label: 'Late', n: stats.late, bar: 'bg-amber-500' },
        { label: 'No show', n: stats.no_show, bar: 'bg-red-600' },
    ];
    return (
        <div>
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-stone-100">
                {parts.map(
                    (part) =>
                        part.n > 0 && (
                            <span
                                key={part.label}
                                className={part.bar}
                                style={{ width: `${(part.n / stats.total) * 100}%` }}
                            />
                        ),
                )}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-stone-600">
                {parts.map((part) => (
                    <li key={part.label} className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${part.bar}`} />
                        {part.label}
                        <span className="ml-auto tabular-nums">{part.n}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Trend({ points }: { points: (number | null)[] }) {
    const known = points.filter((p): p is number => p !== null);
    if (known.length < 2) {
        return <p className="text-xs text-stone-500">Not enough data for a trend yet.</p>;
    }
    const max = Math.max(...known, 0.1);
    const step = 156 / (points.length - 1);
    const path = points
        .flatMap((p, i) => (p === null ? [] : [`${i * step + 2},${44 - (p / max) * 40}`]))
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`)
        .join(' ');
    return (
        <svg viewBox="0 0 160 48" className="h-16 w-full" fill="none" aria-hidden="true">
            <path
                d={path}
                className="stroke-maroon-700"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M2 46 H158" className="stroke-stone-200" strokeWidth={1} />
        </svg>
    );
}

function TypeRows({ types }: { types: Stats['events_by_type']['types'] }) {
    const max = Math.max(...types.map((t) => t.count), 1);
    return (
        <ul className="space-y-2.5">
            {types.map((type) => (
                <li key={type.name} className="flex items-center gap-2 text-xs text-stone-600">
                    <span className="w-20 shrink-0 truncate">{type.name}</span>
                    <span
                        className="h-2 rounded-full bg-maroon-700"
                        style={{ width: `${(type.count / max) * 60}%` }}
                    />
                    <span className="ml-auto tabular-nums">{type.count}</span>
                </li>
            ))}
        </ul>
    );
}

const empty = <p className="text-xs text-stone-500">Nothing to show yet.</p>;

function Statistics({ stats }: { stats: Stats }) {
    const { attendance, duty_hours: hours, acknowledge, events_by_type: types } = stats;
    const pct =
        attendance.total > 0 ? Math.round((attendance.on_time / attendance.total) * 100) : null;
    return (
        <section aria-labelledby="stats-heading" className="mt-8">
            <h2
                id="stats-heading"
                className="flex items-center gap-2 text-lg font-semibold text-stone-900"
            >
                <ChartIcon className="size-5 text-stone-500" />
                Statistics
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    title="Attendance"
                    period={`${attendance.month}, started duties`}
                    value={pct === null ? '--' : String(pct)}
                    unit="% on time"
                >
                    {attendance.total > 0 ? <Split stats={attendance} /> : empty}
                </StatCard>
                <StatCard
                    title="Duty hours"
                    period="Last 8 weeks"
                    value={String(hours.total)}
                    unit="hours"
                >
                    {hours.total > 0 ? (
                        <Bars
                            values={hours.weeks.map((w) => w.hours)}
                            labels={hours.weeks.map((w) => `Week of ${w.week}`)}
                        />
                    ) : (
                        empty
                    )}
                </StatCard>
                <StatCard
                    title="Time to acknowledge"
                    period="Last 30 days"
                    value={
                        acknowledge.median_hours === null ? '--' : String(acknowledge.median_hours)
                    }
                    unit="h median"
                >
                    <Trend points={acknowledge.trend} />
                </StatCard>
                <StatCard
                    title="Events by type"
                    period="Last 6 months"
                    value={String(types.total)}
                    unit="events"
                >
                    {types.types.length > 0 ? <TypeRows types={types.types} /> : empty}
                </StatCard>
            </div>
        </section>
    );
}

function Attention({ data }: { data: DashboardData }) {
    const items: { to: string; label: string; value: number; note: string; urgent: boolean }[] = [];
    if (data.emergencies) {
        items.push({
            to: '/admin/reports',
            label: 'Open emergencies',
            value: data.emergencies.open,
            note:
                data.emergencies.waiting > 0
                    ? `${data.emergencies.waiting} not acknowledged`
                    : 'None waiting',
            urgent: data.emergencies.waiting > 0,
        });
    }
    if (data.reports) {
        const problems = data.reports.overdue + data.reports.missed;
        items.push({
            to: '/admin/reports',
            label: 'Reports needing attention',
            value: problems,
            note: `${data.reports.overdue} overdue, ${data.reports.missed} missed`,
            urgent: problems > 0,
        });
    }
    if (data.messages) {
        items.push({
            to: '/admin/messages',
            label: 'Unread messages',
            value: data.messages.unread,
            note: 'In the DRRMO inbox',
            urgent: false,
        });
    }
    if (data.requests) {
        items.push({
            to: '/admin/requests',
            label: 'Access requests',
            value: data.requests.pending,
            note: 'Waiting for review',
            urgent: false,
        });
    }
    if (data.people) {
        items.push({
            to: '/admin/people',
            label: 'Active people',
            value: data.people.active,
            note: 'Personnel and volunteers',
            urgent: false,
        });
    }
    if (items.length === 0 && !data.memos) return null;
    return (
        <section aria-labelledby="attention-heading" className="mt-8">
            <h2 id="attention-heading" className="text-lg font-semibold text-stone-900">
                Across the system
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-5">
                <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-3 lg:grid-cols-3">
                    {items.map((item) => (
                        <li key={item.label}>
                            <Link
                                to={item.to}
                                className="block h-full rounded-card bg-white p-4 ring-1 ring-stone-200 transition-colors hover:bg-stone-50"
                            >
                                <p className="text-sm font-medium text-stone-800">{item.label}</p>
                                <p
                                    className={`mt-2 text-2xl font-semibold tabular-nums ${item.urgent ? 'text-red-700' : 'text-stone-900'}`}
                                >
                                    {item.value}
                                </p>
                                <p className="mt-1 text-xs text-stone-500">{item.note}</p>
                            </Link>
                        </li>
                    ))}
                </ul>
                {data.memos && (
                    <div className="rounded-card bg-white p-4 ring-1 ring-stone-200 lg:col-span-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-stone-800">Latest memos</h3>
                            <Link
                                to="/admin/memos"
                                className="text-sm font-semibold text-maroon-700 hover:underline"
                            >
                                All memos
                            </Link>
                        </div>
                        {data.memos.recent.length === 0 ? (
                            <p className="mt-3 text-sm text-stone-500">No memos posted yet.</p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {data.memos.recent.map((memo) => (
                                    <li
                                        key={memo.id}
                                        className="flex items-baseline justify-between gap-3 text-sm"
                                    >
                                        <span className="min-w-0 truncate text-stone-800">
                                            {memo.title}
                                        </span>
                                        <span className="shrink-0 text-xs text-stone-500">
                                            {memo.category}, {when(memo.posted_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function Skeleton() {
    return (
        <div aria-busy="true">
            <p role="status" className="sr-only">
                Loading the dashboard...
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-hidden="true">
                {[0, 1, 2, 3].map((cell) => (
                    <div
                        key={cell}
                        className="space-y-2 rounded-card bg-white p-4 ring-1 ring-stone-200 sm:p-5"
                    >
                        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                        <div className="h-8 w-10 animate-pulse rounded bg-stone-200" />
                    </div>
                ))}
            </div>
            <div
                className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-5"
                aria-hidden="true"
            >
                {[2, 3].map((span) => (
                    <div
                        key={span}
                        className={`space-y-4 rounded-card bg-white p-6 ring-1 ring-stone-200 ${span === 3 ? 'lg:col-span-3 lg:row-start-1' : 'lg:col-span-2 lg:col-start-4'}`}
                    >
                        <div className="h-5 w-36 animate-pulse rounded bg-stone-200" />
                        <div className="h-10 animate-pulse rounded bg-stone-200" />
                        <div className="h-10 animate-pulse rounded bg-stone-200" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function Dashboard() {
    const queryClient = useQueryClient();
    const data = useQuery({
        queryKey: ['dashboard'],
        queryFn: getDashboard,
        refetchInterval: 60_000,
    });
    const [today] = useState(() => new Date());
    const [pending, setPending] = useState<DashboardRow | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);
    const noShow = useMutation({
        mutationFn: (row: DashboardRow) => markNoShow(row.id),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                queryClient.invalidateQueries({ queryKey: ['event'] }),
            ]);
            setPending(null);
        },
        onError: (failure) => setDialogError(failMessage(failure)),
    });

    // The time of the last refresh, so "Happening now" and "late" move with the data.
    const now = data.dataUpdatedAt;
    const events = data.data?.today_events ?? [];
    const onDuty = data.data?.on_duty ?? [];
    const late = data.data?.not_on_duty ?? [];
    const waiting = data.data?.unacknowledged ?? [];
    const liveEvents = events.filter((event) => isLive(event, now)).length;
    const assignedToday = events.reduce((sum, event) => sum + event.people_count, 0);
    const firstName = pending?.person.split(' ')[0] ?? '';

    return (
        <div className="mx-auto max-w-[1440px]">
            <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div>
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Dashboard
                    </h1>
                    <p className="mt-1 text-stone-600">{longDay.format(today)}</p>
                </div>
                {data.isSuccess && (
                    <div className="flex items-center gap-1 text-sm text-stone-500">
                        <p className="tabular-nums" aria-live="polite">
                            Updated {time.format(new Date(now))}
                        </p>
                        <button
                            type="button"
                            className="flex size-10 items-center justify-center rounded-control text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
                            aria-label="Refresh now"
                            disabled={data.isFetching}
                            onClick={() => void data.refetch()}
                        >
                            <RefreshIcon
                                className={`size-5 ${data.isFetching ? 'animate-spin' : ''}`}
                            />
                        </button>
                    </div>
                )}
            </header>

            {data.isPending && <Skeleton />}

            {data.isError && (
                <div className="mt-6 max-w-xl space-y-3">
                    <Alert tone="error">
                        The dashboard did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        size="md"
                        loading={data.isFetching}
                        onClick={() => void data.refetch()}
                    >
                        {data.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {data.data && (
                <>
                    <dl className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                        <Stat
                            icon={<CalendarIcon className="size-4" />}
                            label="Events today"
                            value={events.length}
                            note={liveEvents > 0 ? `${liveEvents} happening now` : 'Published only'}
                        />
                        <Stat
                            icon={<PeopleIcon className="size-4" />}
                            label="On duty now"
                            value={onDuty.length}
                            note={
                                assignedToday > 0
                                    ? `Of ${assignedToday} assigned today`
                                    : 'Nobody assigned today'
                            }
                            tone={onDuty.length > 0 ? 'live' : 'plain'}
                        />
                        <Stat
                            icon={<AlertIcon className="size-4" />}
                            label="Late to start"
                            value={late.length}
                            note="30 min past shift start"
                            tone={late.length > 0 ? 'urgent' : 'plain'}
                        />
                        <Stat
                            icon={<ClockIcon className="size-4" />}
                            label="Not acknowledged"
                            value={waiting.length}
                            note="Assigned, not confirmed"
                        />
                    </dl>

                    {/* The people lists come first in the page, so phones see them first.
                        On desktop they move to the right column. */}
                    <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
                        <div className="min-w-0 space-y-6 lg:col-span-2 lg:col-start-4 lg:row-start-1">
                            <Panel
                                id="late-heading"
                                title="Late to start"
                                intro="Shift started 30 minutes ago. Duty not started."
                                count={late.length}
                            >
                                {late.length === 0 ? (
                                    <AllClear
                                        icon={<CheckIcon className="size-5" />}
                                        text="Everyone is on time."
                                    />
                                ) : (
                                    <PeopleRows
                                        rows={late}
                                        aside={(row) => (
                                            <>
                                                {row.starts_at && (
                                                    <p className="text-sm font-semibold text-ember-700 tabular-nums">
                                                        {lateBy(row.starts_at, now)}
                                                    </p>
                                                )}
                                                <button
                                                    type="button"
                                                    className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-semibold text-red-700 ring-1 ring-stone-300 transition-colors ring-inset hover:bg-red-50 hover:ring-red-200 @md:min-h-8 @md:px-2.5 @md:text-xs"
                                                    onClick={() => {
                                                        setDialogError(null);
                                                        setPending(row);
                                                    }}
                                                >
                                                    Mark no show
                                                    <span className="sr-only">: {row.person}</span>
                                                </button>
                                            </>
                                        )}
                                    />
                                )}
                            </Panel>

                            <Panel
                                id="waiting-heading"
                                title="Not acknowledged"
                                intro="Assigned to an upcoming duty, not confirmed yet."
                                count={waiting.length}
                            >
                                {waiting.length === 0 ? (
                                    <AllClear
                                        icon={<CheckIcon className="size-5" />}
                                        text="Everyone has acknowledged."
                                    />
                                ) : (
                                    <PeopleRows
                                        rows={waiting}
                                        aside={(row) => (
                                            <>
                                                <span
                                                    className={`${chipClass} bg-sky-50 text-sky-800 ring-sky-200`}
                                                >
                                                    Assigned
                                                </span>
                                                {row.starts_at && (
                                                    <p className="text-xs text-stone-500 tabular-nums">
                                                        Shift {when(row.starts_at)}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    />
                                )}
                            </Panel>
                        </div>

                        <div className="min-w-0 space-y-6 lg:col-span-3 lg:row-start-1">
                            <Panel
                                id="today-heading"
                                title="Today's events"
                                intro="Open an event to see its duties and people."
                                count={events.length}
                                action={
                                    <Link
                                        to="/admin/events"
                                        className="flex min-h-10 shrink-0 items-center gap-1 rounded-control text-sm font-semibold text-maroon-700 hover:underline"
                                    >
                                        All events
                                        <ChevronIcon className="size-4 -rotate-90" />
                                    </Link>
                                }
                            >
                                <TodayEvents events={events} now={now} />
                            </Panel>

                            <Panel
                                id="on-duty-heading"
                                title="On duty now"
                                intro="Started duty and have not ended it."
                                count={onDuty.length}
                            >
                                {onDuty.length === 0 ? (
                                    <AllClear
                                        icon={<PeopleIcon className="size-5" />}
                                        text="Nobody is on duty right now."
                                    />
                                ) : (
                                    <PeopleRows
                                        rows={onDuty}
                                        aside={(row) => (
                                            <>
                                                <span
                                                    className={`${chipClass} gap-1.5 bg-ember-50 text-ember-700 ring-ember-200`}
                                                >
                                                    <LiveDot pulse />
                                                    On duty
                                                </span>
                                                <p className="text-xs text-stone-500 tabular-nums">
                                                    {row.duty_started_at &&
                                                        `Since ${when(row.duty_started_at)}`}
                                                    {row.ends_at &&
                                                        `${row.duty_started_at ? ', ' : ''}ends ${time.format(new Date(row.ends_at))}`}
                                                </p>
                                            </>
                                        )}
                                    />
                                )}
                            </Panel>
                        </div>
                    </div>

                    <Attention data={data.data} />
                    <Statistics stats={data.data.stats} />
                </>
            )}

            <ConfirmDialog
                open={pending !== null}
                title={`Mark ${pending?.person ?? ''} as no show?`}
                description={`${firstName} did not report for ${pending?.duty ?? 'this duty'} at ${pending?.event.title ?? 'this event'}. Their spot opens so you can fill it. This stays on their record.`}
                confirmLabel="Mark no show"
                loadingLabel="Saving..."
                cancelLabel="Keep"
                tone="danger"
                loading={noShow.isPending}
                error={dialogError}
                onConfirm={() => {
                    if (pending) noShow.mutate(pending);
                }}
                onCancel={() => setPending(null)}
            />
        </div>
    );
}

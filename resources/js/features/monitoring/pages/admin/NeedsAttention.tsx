// A-Reports, Needs attention (the landing tab). A four number summary, then open emergencies
// (oldest waiting first, with a quick Acknowledge), late site reports, and how each event is doing.
// Acknowledge here does not load the place. Only View details does, and the server audits that.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Avatar } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { acknowledgeEmergency, getAttention, type Attention } from '../../api';
import { StatusChip, TypeIcon, typeTone } from '../../components/emergencyUi';
import {
    ago,
    CheckIcon,
    ChevronIcon,
    headCell,
    linkClass,
    nameParts,
    Panel,
    ReportChip,
    typeName,
    useNow,
    when,
} from '../../components/reportsUi';

type OpenEmergency = Attention['emergencies'][number];
type LateReport = Attention['reports'][number];
type EventCounts = Attention['events'][number];

function Stat({
    label,
    hint,
    value,
    dot,
}: {
    label: string;
    hint: string;
    value: number;
    dot: string;
}) {
    return (
        <div className="bg-white px-4 py-4 md:px-5">
            <p className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${value > 0 ? dot : 'bg-stone-300'}`}
                />
                {label}
            </p>
            <p
                className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${value > 0 ? 'text-stone-900' : 'text-stone-400'}`}
            >
                {value}
            </p>
            <p className="mt-0.5 text-sm text-pretty text-stone-500">{hint}</p>
        </div>
    );
}

// Waiting first (escalated before new), then taken on. Oldest first inside each group, because the
// one that has waited longest needs a person most.
function urgency(e: OpenEmergency): number {
    if (e.status === 'sent') return e.escalated ? 0 : 1;
    return 2;
}

function EmergencyRow({ e, now }: { e: OpenEmergency; now: number }) {
    const queryClient = useQueryClient();
    const ack = useMutation({
        mutationFn: () => acknowledgeEmergency(e.id),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['attention'] }),
                queryClient.invalidateQueries({ queryKey: ['emergencies'] }),
            ]);
        },
    });
    const waiting = e.status === 'sent';

    return (
        <li
            className={`relative px-4 py-4 md:px-5 ${waiting ? 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-red-700' : ''}`}
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3 md:items-center">
                    <span
                        className={`flex size-11 shrink-0 items-center justify-center rounded-control ring-1 ${typeTone(waiting)}`}
                    >
                        <TypeIcon type={e.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <p className="font-semibold text-stone-900">
                                {typeName(e.type)} emergency
                            </p>
                            {waiting ? (
                                <StatusChip
                                    kind={e.escalated ? 'escalated' : 'new'}
                                    label={e.escalated ? 'Escalated' : 'Not acknowledged'}
                                />
                            ) : (
                                <StatusChip kind="acknowledged" label="Being handled" />
                            )}
                        </div>
                        <p className="mt-0.5 text-sm text-stone-600">
                            {e.reporter ?? 'Unknown'} · {e.event ?? 'Event'}
                        </p>
                        <p className="mt-0.5 text-sm text-stone-500 tabular-nums">
                            <span className={waiting ? 'font-semibold text-red-800' : ''}>
                                Sent {ago(e.sent_at, now).toLowerCase()}
                            </span>{' '}
                            · {when(e.sent_at, now)}
                            {!waiting && ` · taken on by ${e.acknowledged_by ?? 'someone'}`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 md:shrink-0">
                    {waiting && (
                        <Button
                            size="md"
                            className="flex-1 max-md:min-h-12 md:flex-none"
                            loading={ack.isPending}
                            onClick={() => ack.mutate()}
                        >
                            {ack.isPending ? 'Acknowledging...' : 'Acknowledge'}
                        </Button>
                    )}
                    <Link
                        to={`/admin/reports/emergencies?open=${e.id}`}
                        className="inline-flex min-h-12 flex-1 items-center justify-center rounded-control border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 md:min-h-10 md:flex-none"
                    >
                        View details
                    </Link>
                </div>
            </div>
            {ack.isError && (
                <div className="mt-3">
                    <Alert tone="error">{ack.error.message}</Alert>
                </div>
            )}
        </li>
    );
}

function LateReports({ reports, now }: { reports: LateReport[]; now: number }) {
    return (
        <Panel
            id="attention-reports"
            title="Late site reports"
            count={reports.length}
            aside={
                <Link to="/admin/reports/feed" className={linkClass}>
                    All reports
                    <ChevronIcon className="size-4" />
                </Link>
            }
        >
            {/* Phones and small tablets: one row per report. */}
            <ul className="divide-y divide-stone-100 md:hidden">
                {reports.map((r) => {
                    const [first, last] = nameParts(r.author);
                    return (
                        <li key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                            <Avatar first={first} last={last} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-stone-900">
                                    {r.author ?? 'Unknown'}
                                </p>
                                <p className="truncate text-sm text-stone-600">
                                    {r.event ?? 'Event'}
                                </p>
                                <p className="text-sm text-stone-500 tabular-nums">
                                    Due {when(r.due_at, now)}
                                </p>
                            </div>
                            <ReportChip status={r.status} />
                        </li>
                    );
                })}
            </ul>

            {/* 768 px and up: a table. */}
            <div className="hidden md:block">
                <table className="w-full table-fixed text-left">
                    <colgroup>
                        <col className="w-[34%]" />
                        <col className="w-[30%]" />
                        <col className="w-[22%]" />
                        <col className="w-[14%]" />
                    </colgroup>
                    <thead className="border-b border-stone-200">
                        <tr>
                            <th scope="col" className={headCell}>
                                Person
                            </th>
                            <th scope="col" className={headCell}>
                                Event
                            </th>
                            <th scope="col" className={headCell}>
                                Was due
                            </th>
                            <th scope="col" className={headCell}>
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {reports.map((r) => {
                            const [first, last] = nameParts(r.author);
                            return (
                                <tr key={r.id}>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar first={first} last={last} />
                                            <span className="truncate font-medium text-stone-900">
                                                {r.author ?? 'Unknown'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="truncate px-5 py-3 text-sm text-stone-700">
                                        {r.event ?? 'Event'}
                                    </td>
                                    <td className="px-5 py-3 text-sm tabular-nums">
                                        <p className="text-stone-800">{when(r.due_at, now)}</p>
                                        <p className="text-stone-500">{ago(r.due_at, now)}</p>
                                    </td>
                                    <td className="px-5 py-3">
                                        <ReportChip status={r.status} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}

function Count({ n, tone }: { n: number; tone: string }) {
    return (
        <span className={`tabular-nums ${n > 0 ? `font-semibold ${tone}` : 'text-stone-500'}`}>
            {n}
        </span>
    );
}

// Share of due reports that came in on time. Zero due reports shows a dash.
function OnTimeBar({ ev }: { ev: EventCounts }) {
    const due = ev.on_time + ev.late + ev.overdue + ev.missed;
    if (due === 0) return <span className="text-stone-500">No reports due</span>;
    const share = Math.round((ev.on_time / due) * 100);
    return (
        <div className="flex items-center gap-3">
            <div
                aria-hidden="true"
                className="h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-stone-100"
            >
                <div className="h-full rounded-full bg-green-700" style={{ width: `${share}%` }} />
            </div>
            <span className="w-11 shrink-0 text-right text-stone-700 tabular-nums">{share}%</span>
        </div>
    );
}

function ByEvent({ events }: { events: EventCounts[] }) {
    const feedFor = (ev: EventCounts) => `/admin/reports/feed?event_id=${ev.event_id}`;
    return (
        <Panel
            id="attention-events"
            title="Site reports by event"
            aside={
                <Link to="/admin/reports/feed" className={linkClass}>
                    All reports
                    <ChevronIcon className="size-4" />
                </Link>
            }
        >
            {events.length === 0 ? (
                <p className="px-4 py-10 text-center text-stone-600 md:px-5">
                    No site reports have fallen due yet.
                </p>
            ) : (
                <>
                    {/* Phones and small tablets: the four numbers under each event. */}
                    <ul className="divide-y divide-stone-100 md:hidden">
                        {events.map((ev) => (
                            <li key={ev.event_id}>
                                <Link
                                    to={feedFor(ev)}
                                    className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50 active:bg-stone-100"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold text-stone-900">
                                            {ev.event ?? 'Event'}
                                        </span>
                                        <span className="mt-2 grid grid-cols-4 gap-2">
                                            {(
                                                [
                                                    [ev.on_time, 'On time', 'text-green-800'],
                                                    [ev.late, 'Late', 'text-amber-900'],
                                                    [ev.overdue, 'Overdue', 'text-ember-700'],
                                                    [ev.missed, 'Missed', 'text-red-800'],
                                                ] as const
                                            ).map(([n, label, tone]) => (
                                                <span key={label} className="block">
                                                    <span className="block text-base">
                                                        <Count n={n} tone={tone} />
                                                    </span>
                                                    <span className="block text-xs text-stone-500">
                                                        {label}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                    <ChevronIcon className="size-5 shrink-0 text-stone-400" />
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* 768 px and up: a table where the whole row opens the event's reports. */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[680px] table-fixed text-left text-sm">
                            <thead className="border-b border-stone-200">
                                <tr>
                                    <th scope="col" className={headCell}>
                                        Event
                                    </th>
                                    <th scope="col" className={`${headCell} w-28 text-right`}>
                                        On time
                                    </th>
                                    <th scope="col" className={`${headCell} w-28 text-right`}>
                                        Late
                                    </th>
                                    <th scope="col" className={`${headCell} w-28 text-right`}>
                                        Overdue
                                    </th>
                                    <th scope="col" className={`${headCell} w-28 text-right`}>
                                        Missed
                                    </th>
                                    <th
                                        scope="col"
                                        className={`${headCell} hidden w-56 lg:table-cell`}
                                    >
                                        On time rate
                                    </th>
                                    <th scope="col" className="w-12">
                                        <span className="sr-only">Open</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {events.map((ev) => (
                                    <tr
                                        key={ev.event_id}
                                        className="group relative cursor-pointer transition-colors focus-within:bg-stone-50 hover:bg-stone-50"
                                    >
                                        <td className="px-5 py-3.5">
                                            <Link
                                                to={feedFor(ev)}
                                                className="block truncate font-medium text-stone-900 underline-offset-2 group-hover:text-maroon-700 group-hover:underline after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-maroon-600 focus-visible:after:ring-inset"
                                            >
                                                {ev.event ?? 'Event'}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <Count n={ev.on_time} tone="text-green-800" />
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <Count n={ev.late} tone="text-amber-900" />
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <Count n={ev.overdue} tone="text-ember-700" />
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <Count n={ev.missed} tone="text-red-800" />
                                        </td>
                                        <td className="hidden px-5 py-3.5 lg:table-cell">
                                            <OnTimeBar ev={ev} />
                                        </td>
                                        <td className="py-3.5 pr-4 pl-2">
                                            <ChevronIcon className="size-4 text-stone-300 transition-colors group-hover:text-maroon-700" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </Panel>
    );
}

export function NeedsAttention() {
    const now = useNow();
    const attention = useQuery({
        queryKey: ['attention'],
        queryFn: getAttention,
        refetchInterval: 30_000,
    });

    if (attention.isPending)
        return (
            <div aria-hidden="true" className="space-y-6">
                <div className="h-28 animate-pulse rounded-card bg-stone-200" />
                <div className="h-56 animate-pulse rounded-card bg-stone-200" />
            </div>
        );
    if (attention.isError)
        return (
            <div className="max-w-xl space-y-3">
                <Alert tone="error">This view did not load. Check your connection.</Alert>
                <Button
                    variant="secondary"
                    size="md"
                    loading={attention.isFetching}
                    onClick={() => void attention.refetch()}
                >
                    {attention.isFetching ? 'Retrying...' : 'Retry'}
                </Button>
            </div>
        );

    const { reports, events } = attention.data;
    const emergencies = [...attention.data.emergencies].sort(
        (a, b) => urgency(a) - urgency(b) || a.sent_at.localeCompare(b.sent_at),
    );
    const waiting = emergencies.filter((e) => e.status === 'sent').length;
    const overdue = reports.filter((r) => r.status === 'overdue').length;
    const missed = reports.filter((r) => r.status === 'missed').length;
    const allClear = emergencies.length === 0 && reports.length === 0;

    return (
        <div className="space-y-6">
            <div
                role="group"
                aria-label="Summary"
                className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-stone-200 ring-1 ring-stone-200 lg:grid-cols-4"
            >
                <Stat
                    label="Not acknowledged"
                    hint="Emergencies nobody took on yet"
                    value={waiting}
                    dot="bg-red-700"
                />
                <Stat
                    label="Being handled"
                    hint="Acknowledged, not resolved"
                    value={emergencies.length - waiting}
                    dot="bg-green-700"
                />
                <Stat
                    label="Overdue reports"
                    hint="Past due, can still be sent"
                    value={overdue}
                    dot="bg-ember-500"
                />
                <Stat label="Missed reports" hint="Never sent" value={missed} dot="bg-red-700" />
            </div>

            {allClear && (
                <div className="flex items-center gap-4 rounded-card bg-white px-4 py-4 ring-1 ring-stone-200 md:px-5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-control border border-stone-200 text-green-700">
                        <CheckIcon className="size-6" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="font-semibold text-stone-900">All clear</h2>
                        <p className="text-sm text-pretty text-stone-600">
                            No open emergencies and no late site reports. This page checks again
                            every 30 seconds.
                        </p>
                    </div>
                </div>
            )}

            {emergencies.length > 0 && (
                <Panel
                    id="attention-emergencies"
                    title="Open emergencies"
                    count={emergencies.length}
                    aside={
                        <Link to="/admin/reports/emergencies" className={linkClass}>
                            Emergencies
                            <ChevronIcon className="size-4" />
                        </Link>
                    }
                >
                    <ul className="divide-y divide-stone-100">
                        {emergencies.map((e) => (
                            <EmergencyRow key={e.id} e={e} now={now} />
                        ))}
                    </ul>
                </Panel>
            )}

            {reports.length > 0 && <LateReports reports={reports} now={now} />}

            <ByEvent events={events} />
        </div>
    );
}

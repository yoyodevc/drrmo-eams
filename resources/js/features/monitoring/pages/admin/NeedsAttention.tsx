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

// One summary number. The number carries the weight; a thin bar on top marks the ones above zero.
function Stat({
    label,
    hint,
    value,
    tone,
    bar,
}: {
    label: string;
    hint: string;
    value: number;
    tone: string;
    bar: string;
}) {
    const on = value > 0;
    return (
        <div className="relative bg-white px-4 pt-4 pb-4 md:px-5 md:pt-5">
            <span
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-[3px] max-lg:hidden ${on ? bar : 'bg-transparent'}`}
            />
            <p className="text-sm font-medium text-stone-600">{label}</p>
            <p
                className={`mt-1 text-4xl leading-none font-semibold tracking-tight tabular-nums md:mt-2 ${on ? tone : 'text-stone-300'}`}
            >
                {value}
            </p>
            <p className="mt-2 text-sm text-pretty text-stone-500 max-sm:hidden">{hint}</p>
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
            <ul className="divide-y divide-stone-100">
                {reports.map((r) => {
                    const [first, last] = nameParts(r.author);
                    return (
                        <li
                            key={r.id}
                            className="flex min-h-16 items-center gap-3 px-4 py-3 md:gap-4 md:px-5"
                        >
                            <Avatar first={first} last={last} />
                            <div className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-6">
                                <p className="truncate font-semibold text-stone-900">
                                    {r.author ?? 'Unknown'}
                                </p>
                                <p className="truncate text-sm text-stone-600">
                                    {r.event ?? 'Event'}
                                </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1 md:w-48 md:flex-row-reverse lg:w-72 md:items-center md:justify-start md:gap-3">
                                <ReportChip status={r.status} />
                                <p className="text-sm whitespace-nowrap text-stone-500 tabular-nums">
                                    <span className="max-lg:hidden">{when(r.due_at, now)} · </span>
                                    {ago(r.due_at, now)}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}

const parts = [
    { key: 'on_time', label: 'On time', bar: 'bg-green-600', dot: 'bg-green-600' },
    { key: 'late', label: 'Late', bar: 'bg-amber-400', dot: 'bg-amber-400' },
    { key: 'overdue', label: 'Overdue', bar: 'bg-ember-500', dot: 'bg-ember-500' },
    { key: 'missed', label: 'Missed', bar: 'bg-red-700', dot: 'bg-red-700' },
] as const;

// How the due reports of one event split up, as one bar. The numbers sit under it, so the bar is
// never the only way to read them.
function Health({ ev }: { ev: EventCounts }) {
    const due = ev.on_time + ev.late + ev.overdue + ev.missed;
    return (
        <div className="min-w-0">
            <div
                aria-hidden="true"
                className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-stone-100"
            >
                {due > 0 &&
                    parts.map(
                        (p) =>
                            ev[p.key] > 0 && (
                                <span
                                    key={p.key}
                                    className={`h-full ${p.bar}`}
                                    style={{ width: `${(ev[p.key] / due) * 100}%` }}
                                />
                            ),
                    )}
            </div>
            <ul className="mt-2 grid grid-cols-4 gap-2 text-sm text-stone-600 tabular-nums sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                {parts.map((p) => (
                    <li
                        key={p.key}
                        className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5"
                    >
                        <span className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className={`size-2 rounded-full ${ev[p.key] > 0 ? p.dot : 'bg-stone-200'}`}
                            />
                            <span className={ev[p.key] > 0 ? 'font-semibold text-stone-900' : ''}>
                                {ev[p.key]}
                            </span>
                        </span>
                        <span className="max-sm:text-xs max-sm:text-stone-500">
                            {p.label.toLowerCase()}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ByEvent({ events }: { events: EventCounts[] }) {
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
                <ul className="divide-y divide-stone-100">
                    {events.map((ev) => {
                        const due = ev.on_time + ev.late + ev.overdue + ev.missed;
                        const share = due > 0 ? Math.round((ev.on_time / due) * 100) : null;
                        return (
                            <li key={ev.event_id}>
                                <Link
                                    to={`/admin/reports/feed?event_id=${ev.event_id}`}
                                    className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-maroon-600 active:bg-stone-100 md:gap-4 md:px-5"
                                >
                                    <span className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center md:gap-8">
                                        <span className="min-w-0">
                                            <span className="block truncate font-semibold text-stone-900 group-hover:text-maroon-700">
                                                {ev.event ?? 'Event'}
                                            </span>
                                            <span className="mt-0.5 block text-sm text-stone-500 tabular-nums">
                                                {share === null
                                                    ? 'No reports due yet'
                                                    : `${due} due · ${share}% on time`}
                                            </span>
                                        </span>
                                        {due > 0 && <Health ev={ev} />}
                                    </span>
                                    <ChevronIcon className="size-5 shrink-0 text-stone-300 transition-colors group-hover:text-maroon-700" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
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
                    tone="text-red-700"
                    bar="bg-red-700"
                />
                <Stat
                    label="Being handled"
                    hint="Acknowledged, not resolved"
                    value={emergencies.length - waiting}
                    tone="text-stone-900"
                    bar="bg-green-600"
                />
                <Stat
                    label="Overdue reports"
                    hint="Past due, can still be sent"
                    value={overdue}
                    tone="text-ember-700"
                    bar="bg-ember-500"
                />
                <Stat
                    label="Missed reports"
                    hint="Never sent"
                    value={missed}
                    tone="text-red-800"
                    bar="bg-red-700"
                />
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

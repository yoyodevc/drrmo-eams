// A-Reports, Needs attention (the landing tab). A count row, then open emergencies (with a quick
// Acknowledge), then overdue and missed reports, then a count for each event.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { acknowledgeEmergency, getAttention, type Attention } from '../../api';
import { StatusChip, TypeIcon } from '../../components/emergencyUi';

const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
    return (
        <div className="rounded-card bg-white px-4 py-3 ring-1 ring-stone-200">
            <p className="text-sm text-stone-600">{label}</p>
            <p
                className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${value > 0 ? tone : 'text-stone-300'}`}
            >
                {value}
            </p>
        </div>
    );
}

function EmergencyRow({ e }: { e: Attention['emergencies'][number] }) {
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
            className={`rounded-card bg-white p-4 ring-1 ${waiting ? 'border-l-4 border-red-700 ring-red-200' : 'ring-stone-200'}`}
        >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-control ring-1 ${waiting ? 'text-red-700 ring-red-200' : 'text-stone-500 ring-stone-200'}`}
                >
                    <TypeIcon type={e.type} />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="font-semibold text-stone-900">
                            <span className="capitalize">{e.type}</span> · {e.reporter ?? 'Unknown'}
                        </p>
                        {waiting ? (
                            <StatusChip
                                kind={e.escalated ? 'escalated' : 'new'}
                                label={e.escalated ? 'Escalated' : 'Not acknowledged'}
                            />
                        ) : (
                            <StatusChip kind="acknowledged" />
                        )}
                    </div>
                    <p className="text-sm text-stone-600 tabular-nums">
                        {e.event ?? 'Event'} · sent {stamp.format(new Date(e.sent_at))}
                        {!waiting && ` · taken on by ${e.acknowledged_by ?? 'someone'}`}
                    </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                    {waiting && (
                        <Button
                            size="md"
                            className="flex-1 sm:flex-none"
                            loading={ack.isPending}
                            onClick={() => ack.mutate()}
                        >
                            {ack.isPending ? 'Acknowledging...' : 'Acknowledge'}
                        </Button>
                    )}
                    <Link
                        to={`/admin/reports/emergencies?open=${e.id}`}
                        className="inline-flex min-h-10 flex-1 items-center justify-center rounded-control border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50 sm:flex-none"
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

export function NeedsAttention() {
    const attention = useQuery({
        queryKey: ['attention'],
        queryFn: getAttention,
        refetchInterval: 30_000,
    });

    if (attention.isPending)
        return (
            <div aria-hidden="true" className="space-y-3">
                <div className="h-24 animate-pulse rounded-card bg-stone-200" />
                <div className="h-40 animate-pulse rounded-card bg-stone-200" />
            </div>
        );
    if (attention.isError)
        return (
            <div className="max-w-xl space-y-3">
                <Alert tone="error">This view did not load. Check your connection.</Alert>
                <Button variant="secondary" size="md" onClick={() => void attention.refetch()}>
                    Retry
                </Button>
            </div>
        );

    const { emergencies, reports, events } = attention.data;
    const waiting = emergencies.filter((e) => e.status === 'sent').length;
    const overdue = reports.filter((r) => r.status === 'overdue').length;
    const missed = reports.filter((r) => r.status === 'missed').length;
    const nothing = emergencies.length === 0 && reports.length === 0;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Not acknowledged" value={waiting} tone="text-red-700" />
                <Stat
                    label="Open, taken on"
                    value={emergencies.length - waiting}
                    tone="text-stone-900"
                />
                <Stat label="Overdue reports" value={overdue} tone="text-ember-700" />
                <Stat label="Missed reports" value={missed} tone="text-red-800" />
            </div>

            {nothing && (
                <div className="rounded-card bg-white p-8 text-center ring-1 ring-stone-200">
                    <p className="font-semibold text-stone-900">Nothing needs attention</p>
                    <p className="mt-1 text-sm text-stone-600">
                        No open emergencies and no overdue or missed reports. This page checks again
                        every 30 seconds.
                    </p>
                </div>
            )}

            {emergencies.length > 0 && (
                <section aria-labelledby="attention-emergencies">
                    <h2 id="attention-emergencies" className="text-lg font-semibold text-stone-900">
                        Open emergencies
                    </h2>
                    <ul className="mt-3 space-y-3">
                        {emergencies.map((e) => (
                            <EmergencyRow key={e.id} e={e} />
                        ))}
                    </ul>
                </section>
            )}

            {reports.length > 0 && (
                <section aria-labelledby="attention-reports">
                    <h2 id="attention-reports" className="text-lg font-semibold text-stone-900">
                        Overdue and missed reports
                    </h2>
                    <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        {reports.map((r) => (
                            <li key={r.id} className="flex items-center gap-4 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-stone-900">
                                        {r.author ?? 'Unknown'}
                                    </p>
                                    <p className="text-sm text-stone-600 tabular-nums">
                                        {r.event ?? 'Event'} · due{' '}
                                        {stamp.format(new Date(r.due_at))}
                                    </p>
                                </div>
                                <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${r.status === 'missed' ? 'bg-red-100 text-red-900 ring-red-300' : 'bg-ember-50 text-ember-700 ring-ember-200'}`}
                                >
                                    {r.status === 'missed' ? 'Missed' : 'Overdue'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section aria-labelledby="attention-events">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="attention-events" className="text-lg font-semibold text-stone-900">
                        Reports for each event
                    </h2>
                    <Link
                        to="/admin/reports/feed"
                        className="text-sm font-semibold text-maroon-700 hover:underline"
                    >
                        Read the reports
                    </Link>
                </div>
                {events.length === 0 ? (
                    <p className="mt-2 text-stone-600">No reports have fallen due yet.</p>
                ) : (
                    <div className="mt-3 overflow-x-auto rounded-card bg-white ring-1 ring-stone-200">
                        <table className="w-full min-w-[520px] text-left text-sm">
                            <thead className="bg-stone-50 text-xs tracking-[0.08em] text-stone-600 uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Event</th>
                                    <th className="px-4 py-3 text-right font-semibold">On time</th>
                                    <th className="px-4 py-3 text-right font-semibold">Late</th>
                                    <th className="px-4 py-3 text-right font-semibold">Overdue</th>
                                    <th className="px-4 py-3 text-right font-semibold">Missed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {events.map((ev) => (
                                    <tr key={ev.event_id}>
                                        <td className="px-4 py-3 font-medium">
                                            <Link
                                                to={`/admin/reports/feed?event_id=${ev.event_id}`}
                                                className="text-stone-900 hover:text-maroon-700 hover:underline"
                                            >
                                                {ev.event}
                                            </Link>
                                        </td>
                                        <Cell n={ev.on_time} tone="text-green-800" />
                                        <Cell n={ev.late} tone="text-amber-900" />
                                        <Cell n={ev.overdue} tone="text-ember-700" />
                                        <Cell n={ev.missed} tone="text-red-800" />
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function Cell({ n, tone }: { n: number; tone: string }) {
    return (
        <td className="px-4 py-3 text-right tabular-nums">
            <span className={n > 0 ? `font-semibold ${tone}` : 'text-stone-400'}>{n}</span>
        </td>
    );
}

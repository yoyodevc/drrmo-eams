// A-Needs attention. Open emergencies first, then overdue and missed reports, then a count for each
// event (on time, late, overdue, missed). For admins and the reviewer marshals.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { getAttention } from '../../api';
import { StatusChip, TypeIcon } from '../../components/emergencyUi';

const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

export function NeedsAttention() {
    const attention = useQuery({
        queryKey: ['attention'],
        queryFn: getAttention,
        refetchInterval: 30_000,
    });

    if (attention.isPending) return <p className="text-stone-600">Loading...</p>;
    if (attention.isError) return <Alert tone="error">This view did not load. Try again.</Alert>;
    const { emergencies, reports, events } = attention.data;
    const nothing = emergencies.length === 0 && reports.length === 0;

    const count = (n: number, tone: string) => (
        <span className={n > 0 ? `font-semibold ${tone}` : 'text-stone-400'}>{n}</span>
    );

    return (
        <div className="mx-auto max-w-4xl">
            <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                Needs attention
            </h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                Open emergencies, then overdue and missed reports.
            </p>

            {nothing && (
                <div className="mt-6">
                    <Alert tone="success">Nothing needs attention right now.</Alert>
                </div>
            )}

            {emergencies.length > 0 && (
                <section className="mt-8" aria-label="Open emergencies">
                    <h2 className="text-lg font-semibold text-red-800">
                        Open emergencies{' '}
                        <span className="text-base font-normal text-stone-600 tabular-nums">
                            ({emergencies.length})
                        </span>
                    </h2>
                    <ul className="mt-3 space-y-3">
                        {emergencies.map((e) => (
                            <li
                                key={e.id}
                                className="flex items-center gap-4 rounded-card border-l-4 border-red-700 bg-white p-4 ring-1 ring-red-200"
                            >
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-control text-red-700 ring-1 ring-red-200">
                                    <TypeIcon type={e.type} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-stone-900">
                                        <span className="capitalize">{e.type}</span> ·{' '}
                                        {e.reporter ?? 'Unknown'}
                                    </p>
                                    <p className="text-sm text-stone-600 tabular-nums">
                                        {e.event ?? 'Event'} · sent{' '}
                                        {stamp.format(new Date(e.sent_at))}
                                    </p>
                                </div>
                                {e.status === 'sent' ? (
                                    e.escalated ? (
                                        <StatusChip kind="escalated" label="Escalated" />
                                    ) : (
                                        <StatusChip kind="new" label="Not acknowledged" />
                                    )
                                ) : (
                                    <StatusChip
                                        kind="acknowledged"
                                        label={`Acknowledged by ${e.acknowledged_by ?? 'someone'}`}
                                    />
                                )}
                                <Link
                                    to="/admin/emergencies"
                                    className="inline-flex min-h-10 items-center rounded-control border border-stone-300 px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50"
                                >
                                    Open
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {reports.length > 0 && (
                <section className="mt-8" aria-label="Overdue and missed reports">
                    <h2 className="text-lg font-semibold text-stone-900">
                        Overdue and missed reports{' '}
                        <span className="text-base font-normal text-stone-600 tabular-nums">
                            ({reports.length})
                        </span>
                    </h2>
                    <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        {reports.map((r) => (
                            <li key={r.id} className="flex items-center gap-4 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-stone-900">
                                        {r.event ?? 'Event'}
                                    </p>
                                    <p className="text-sm text-stone-600 tabular-nums">
                                        {r.author ?? 'Unknown'} · due{' '}
                                        {stamp.format(new Date(r.due_at))}
                                    </p>
                                </div>
                                <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${r.status === 'missed' ? 'bg-red-100 text-red-900 ring-red-300' : 'bg-red-50 text-red-800 ring-red-200'}`}
                                >
                                    {r.status === 'missed' ? 'Missed' : 'Overdue'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="mt-8" aria-label="Reports for each event">
                <h2 className="text-lg font-semibold text-stone-900">Reports for each event</h2>
                {events.length === 0 ? (
                    <p className="mt-2 text-stone-600">No reports have fallen due yet.</p>
                ) : (
                    <div className="mt-3 overflow-x-auto rounded-card bg-white ring-1 ring-stone-200">
                        <table className="w-full text-left text-sm">
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
                                        <td className="px-4 py-3 font-medium text-stone-900">
                                            {ev.event}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {count(ev.on_time, 'text-green-800')}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {count(ev.late, 'text-amber-900')}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {count(ev.overdue, 'text-red-800')}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {count(ev.missed, 'text-red-900')}
                                        </td>
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

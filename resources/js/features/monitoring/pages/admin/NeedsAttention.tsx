// A-Needs attention. Open emergencies first, then overdue and missed reports, then a count for each
// event (on time, late, overdue, missed). For admins and the reviewer marshals. Functional first.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { getAttention } from '../../api';

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

    return (
        <div className="mx-auto max-w-4xl">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                Needs attention
            </h1>
            <p className="mt-1 text-base text-stone-600">
                Open emergencies, then overdue and missed reports.
            </p>

            {nothing && (
                <div className="mt-4">
                    <Alert tone="success">Nothing needs attention right now.</Alert>
                </div>
            )}

            {emergencies.length > 0 && (
                <section className="mt-6" aria-label="Open emergencies">
                    <h2 className="text-lg font-semibold text-red-800">Open emergencies</h2>
                    <ul className="mt-2 space-y-2">
                        {emergencies.map((e) => (
                            <li
                                key={e.id}
                                className="rounded-card bg-white p-4 ring-1 ring-red-200"
                            >
                                <p className="font-semibold text-stone-900 capitalize">
                                    {e.type} · {e.reporter ?? 'Unknown'}
                                </p>
                                <p className="text-sm text-stone-600">
                                    {e.event ?? 'Event'} · sent {stamp.format(new Date(e.sent_at))}{' '}
                                    ·{' '}
                                    {e.status === 'sent'
                                        ? e.escalated
                                            ? 'escalated, not acknowledged'
                                            : 'not acknowledged'
                                        : `acknowledged by ${e.acknowledged_by ?? 'someone'}`}
                                </p>
                                <Link
                                    to="/admin/emergencies"
                                    className="text-sm font-semibold text-maroon-700 underline"
                                >
                                    Open
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {reports.length > 0 && (
                <section className="mt-6" aria-label="Overdue and missed reports">
                    <h2 className="text-lg font-semibold text-amber-900">
                        Overdue and missed reports
                    </h2>
                    <ul className="mt-2 space-y-2">
                        {reports.map((r) => (
                            <li
                                key={r.id}
                                className="rounded-card bg-white p-4 ring-1 ring-stone-200"
                            >
                                <p className="font-semibold text-stone-900">
                                    {r.event ?? 'Event'} ·{' '}
                                    <span
                                        className={
                                            r.status === 'missed'
                                                ? 'text-red-800'
                                                : 'text-amber-900'
                                        }
                                    >
                                        {r.status === 'missed' ? 'Missed' : 'Overdue'}
                                    </span>
                                </p>
                                <p className="text-sm text-stone-600">
                                    {r.author ?? 'Unknown'} · due {stamp.format(new Date(r.due_at))}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="mt-6" aria-label="Reports for each event">
                <h2 className="text-lg font-semibold text-stone-900">Reports for each event</h2>
                {events.length === 0 ? (
                    <p className="mt-2 text-stone-600">No reports have fallen due yet.</p>
                ) : (
                    <table className="mt-2 w-full text-left text-sm">
                        <thead className="text-stone-600">
                            <tr>
                                <th className="py-2 pr-3 font-medium">Event</th>
                                <th className="py-2 pr-3 font-medium">On time</th>
                                <th className="py-2 pr-3 font-medium">Late</th>
                                <th className="py-2 pr-3 font-medium">Overdue</th>
                                <th className="py-2 font-medium">Missed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((ev) => (
                                <tr key={ev.event_id} className="border-t border-stone-200">
                                    <td className="py-2 pr-3 font-medium text-stone-900">
                                        {ev.event}
                                    </td>
                                    <td className="py-2 pr-3 tabular-nums">{ev.on_time}</td>
                                    <td className="py-2 pr-3 tabular-nums">{ev.late}</td>
                                    <td className="py-2 pr-3 tabular-nums">{ev.overdue}</td>
                                    <td className="py-2 tabular-nums">{ev.missed}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}

// On the report form: the emergencies in this event since the last report, so the marshal can sum them
// up. "Add to summary" puts a line in the text. Reviewers and admins also get a link to the inbox.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useMe } from '@/app/auth';
import { listEmergenciesSinceLastReport, type SinceEmergency } from '../api';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function summaryLine(e: SinceEmergency): string {
    const note = e.note ? `: ${e.note}` : '';
    return `${clock.format(new Date(e.sent_at))} ${e.type} emergency from ${e.reporter ?? 'a person on duty'}${note} (${e.status}).`;
}

export function EmergenciesSinceLast({
    slotId,
    onAdd,
}: {
    slotId: number;
    onAdd: (line: string) => void;
}) {
    const me = useMe().data;
    const list = useQuery({
        queryKey: ['report-slot-emergencies', slotId],
        queryFn: () => listEmergenciesSinceLastReport(slotId),
    });
    const items = list.data ?? [];
    if (items.length === 0) return null;
    const inboxLink = me?.permissions.includes('reports.view')
        ? me.home === '/admin'
            ? '/admin/emergencies'
            : '/me/emergencies'
        : null;

    return (
        <section
            aria-label="Emergencies since the last report"
            className="mt-6 rounded-card bg-red-50 p-4 ring-1 ring-red-200"
        >
            <h2 className="text-sm font-semibold text-red-900">
                {items.length === 1
                    ? '1 emergency since the last report'
                    : `${items.length} emergencies since the last report`}
            </h2>
            <ul className="mt-2 space-y-2">
                {items.map((e) => (
                    <li key={e.id} className="text-sm text-stone-800">
                        <span className="font-medium capitalize">{e.type}</span> ·{' '}
                        {e.reporter ?? 'Unknown'} · {clock.format(new Date(e.sent_at))} · {e.status}
                        {e.note && <span className="block text-stone-700">{e.note}</span>}
                        <button
                            type="button"
                            className="mt-0.5 font-semibold text-maroon-700 underline"
                            onClick={() => onAdd(summaryLine(e))}
                        >
                            Add to summary
                        </button>
                    </li>
                ))}
            </ul>
            {inboxLink && (
                <Link
                    to={inboxLink}
                    className="mt-3 inline-block text-sm font-semibold text-maroon-700 underline"
                >
                    Open the emergencies
                </Link>
            )}
        </section>
    );
}

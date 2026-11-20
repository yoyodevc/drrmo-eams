// On the report form: the emergencies in this event since the last report, so the marshal can sum them
// up. "Add to summary" puts a line in the text. Reviewers and admins also get a link to the inbox.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useMe } from '@/app/auth';
import { listEmergenciesSinceLastReport, type SinceEmergency } from '../api';
import { TypeIcon } from './emergencyUi';

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
            ? '/admin/reports/emergencies'
            : '/me/emergencies'
        : null;

    return (
        <section
            aria-label="Emergencies since the last report"
            className="mt-6 rounded-card border-l-4 border-red-700 bg-white p-4 ring-1 ring-stone-200"
        >
            <h2 className="text-base font-semibold text-red-800">
                {items.length === 1
                    ? '1 emergency since the last report'
                    : `${items.length} emergencies since the last report`}
            </h2>
            <ul className="mt-3 divide-y divide-stone-100">
                {items.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control text-red-700 ring-1 ring-red-200">
                            <TypeIcon type={e.type} className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1 text-sm">
                            <p className="font-semibold text-stone-900">
                                <span className="capitalize">{e.type}</span> ·{' '}
                                {e.reporter ?? 'Unknown'}
                            </p>
                            <p className="text-stone-600 tabular-nums">
                                {clock.format(new Date(e.sent_at))} · {e.status}
                            </p>
                            {e.note && <p className="mt-1 text-pretty text-stone-800">{e.note}</p>}
                            <button
                                type="button"
                                className="mt-1 inline-flex min-h-8 items-center font-semibold text-maroon-700 underline"
                                onClick={() => onAdd(summaryLine(e))}
                            >
                                Add to summary
                            </button>
                        </div>
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

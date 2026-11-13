// Shown at the top of My duties for a designated reporter: the reports that are due now (S4.5, S4.6).
// Nothing shows for people who have no open slot.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { listReportSlots } from '../api';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function ReportDueCard() {
    const slots = useQuery({
        queryKey: ['report-slots'],
        queryFn: listReportSlots,
        // A new slot appears while the page is open.
        refetchInterval: 60_000,
    });
    const open = (slots.data ?? []).filter((s) => s.status === 'pending' || s.status === 'overdue');
    if (open.length === 0) return null;

    return (
        <section
            aria-label="Reports due"
            className="mt-4 rounded-card bg-white ring-1 ring-ember-200"
        >
            <h2 className="px-4 pt-3 text-sm font-semibold text-ember-800">
                {open.length === 1 ? '1 report is due' : `${open.length} reports are due`}
            </h2>
            <ul className="divide-y divide-stone-100">
                {open.map((slot) => (
                    <li key={slot.id}>
                        <Link
                            to={`/me/reports/${slot.id}`}
                            className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
                        >
                            <span className="min-w-0">
                                <span className="block truncate font-medium text-stone-900">
                                    {slot.event}
                                </span>
                                <span className="block text-sm text-stone-600">
                                    Due {clock.format(new Date(slot.due_at))}
                                    {slot.status === 'overdue' && ' · overdue'}
                                </span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-maroon-700">
                                Write report
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

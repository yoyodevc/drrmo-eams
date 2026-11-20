// M-Reports. The one place on a phone to send an emergency, write a report that is due, and (for
// the reviewer marshals) reach what needs attention. The same things live elsewhere, but buried:
// the emergency button sits on the duty card and the due report only shows on My duties.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useMe } from '@/app/auth';
import { listMyAssignments } from '@/features/events/api';
import { getAttention } from '../../api';
import { EmergencySender } from '../../components/EmergencySender';
import { ReportDueCard } from '../../components/ReportDueCard';
import { ago, ChevronIcon, InboxIcon, useNow } from '../../components/reportsUi';
import { useOpenEmergencies } from '../../hooks/useOpenEmergencies';

const heading = 'text-xs font-semibold tracking-[0.14em] text-stone-600 uppercase';

function EmergencySection() {
    const duties = useQuery({ queryKey: ['my-assignments'], queryFn: listMyAssignments });
    const onDuty = (duties.data ?? []).filter((d) => d.status === 'on_duty');

    return (
        <section aria-label="Send an emergency">
            <h2 className={heading}>Emergency</h2>
            {duties.isPending ? (
                <p className="mt-2 text-stone-600">Loading...</p>
            ) : onDuty.length === 0 ? (
                <div className="mt-2 rounded-card bg-white p-4 ring-1 ring-stone-200">
                    <p className="font-medium text-stone-900">You are not on duty</p>
                    <p className="mt-1 text-sm text-pretty text-stone-600">
                        You can send an emergency once you have started your duty.
                    </p>
                    <Link
                        to="/me"
                        className="mt-3 inline-flex min-h-12 items-center text-sm font-semibold text-maroon-700"
                    >
                        Go to my duties
                    </Link>
                </div>
            ) : (
                onDuty.map((duty) => (
                    <div key={duty.id} className="mt-2">
                        {onDuty.length > 1 && (
                            <p className="text-sm font-medium text-stone-800">{duty.event.title}</p>
                        )}
                        <EmergencySender assignmentId={duty.id} />
                    </div>
                ))
            )}
        </section>
    );
}

function ReviewSection() {
    const { open, waiting, loaded } = useOpenEmergencies();
    const now = useNow();
    const attention = useQuery({
        queryKey: ['attention'],
        queryFn: getAttention,
        refetchInterval: 30_000,
    });
    const late = attention.data?.reports ?? [];

    return (
        <section aria-label="Needs attention" className="mt-8">
            <h2 className={heading}>Needs attention</h2>
            <Link
                to="/me/emergencies"
                className={`mt-2 flex min-h-16 items-center gap-3 rounded-card bg-white p-4 ring-1 ${waiting > 0 ? 'ring-red-300' : 'ring-stone-200'}`}
            >
                <InboxIcon className="size-6 shrink-0 text-stone-500" />
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-stone-900">Emergencies</span>
                    <span className="block text-sm text-stone-600">
                        {!loaded
                            ? 'Loading...'
                            : open.length === 0
                              ? 'None open'
                              : `${open.length} open${waiting > 0 ? `, ${waiting} not acknowledged` : ''}`}
                    </span>
                </span>
                <ChevronIcon className="size-5 shrink-0 text-stone-400" />
            </Link>

            <div className="mt-3 rounded-card bg-white ring-1 ring-stone-200">
                <h3 className="px-4 pt-3 font-semibold text-stone-900">Late site reports</h3>
                {attention.isPending ? (
                    <p className="px-4 py-3 text-sm text-stone-600">Loading...</p>
                ) : late.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-stone-600">No report is late.</p>
                ) : (
                    <ul className="mt-1 divide-y divide-stone-100">
                        {late.map((r) => (
                            <li key={r.id} className="px-4 py-3">
                                <p className="font-medium text-stone-900">{r.event ?? 'Event'}</p>
                                <p className="text-sm text-stone-600">
                                    {r.author ?? 'Reporter'} · due {ago(r.due_at, now)} ·{' '}
                                    {r.status === 'missed' ? 'missed' : 'overdue'}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

export function MyReports() {
    const me = useMe().data;
    const reviewer = me?.permissions.includes('reports.view') ?? false;

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Reports</h1>
            <p className="mt-1 text-pretty text-stone-600">
                Send an emergency or write the report that is due.
            </p>

            <div className="mt-6">
                <EmergencySection />
            </div>

            <section aria-label="Site reports" className="mt-8">
                <h2 className={heading}>Site reports</h2>
                <ReportDueCard />
                <p className="mt-2 text-sm text-pretty text-stone-600">
                    Site reports are due every 2 hours for designated reporters. One shows here when
                    it is due.
                </p>
            </section>

            {reviewer && <ReviewSection />}
        </div>
    );
}

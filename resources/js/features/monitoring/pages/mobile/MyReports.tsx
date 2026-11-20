// M-Reports. The one place on a phone to send an emergency, write a report that is due, and (for
// the reviewer marshals) reach what needs attention. The same things live elsewhere, but buried:
// the emergency button sits on the duty card and the due report only shows on My duties.
// Quiet on purpose: white cards with hairline rows, small outline icons, and red only where
// something is urgent, so it reads like the admin pages.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useMe } from '@/app/auth';
import { listMyAssignments } from '@/features/events/api';
import { getAttention, listReportSlots } from '../../api';
import { EmergencySender, MyEmergencyList } from '../../components/EmergencySender';
import { ago, ChevronIcon, ClockIcon, InboxIcon, useNow } from '../../components/reportsUi';
import { useOpenEmergencies } from '../../hooks/useOpenEmergencies';

const eyebrow = 'text-xs font-semibold tracking-wide text-stone-500 uppercase';
const card = 'mt-2 rounded-card bg-white ring-1 ring-stone-200';
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function Skeleton() {
    return <div aria-hidden="true" className="mt-2 h-20 animate-pulse rounded-card bg-stone-200" />;
}

function EmergencySection() {
    const duties = useQuery({ queryKey: ['my-assignments'], queryFn: listMyAssignments });
    const onDuty = (duties.data ?? []).filter((d) => d.status === 'on_duty');

    return (
        <section aria-labelledby="emergency-heading">
            <h2 id="emergency-heading" className={eyebrow}>
                Emergency
            </h2>
            {duties.isPending ? (
                <Skeleton />
            ) : onDuty.length === 0 ? (
                <div className={`${card} flex items-start gap-3 p-4`}>
                    <ClockIcon className="mt-0.5 size-5 shrink-0 text-stone-400" />
                    <div className="min-w-0">
                        <p className="font-medium text-stone-900">You are not on duty</p>
                        <p className="mt-0.5 text-sm text-pretty text-stone-600">
                            The emergency button shows here once you start your duty.
                        </p>
                        <Link
                            to="/me"
                            className="mt-1 inline-flex min-h-12 items-center text-sm font-semibold text-maroon-700"
                        >
                            Go to my duties
                        </Link>
                    </div>
                </div>
            ) : (
                onDuty.map((duty) => (
                    <div key={duty.id} className={`${card} p-4`}>
                        <p className="flex items-center gap-2 text-sm text-stone-600">
                            <span aria-hidden="true" className="size-2 rounded-full bg-ember-600" />
                            <span className="min-w-0 truncate">
                                On duty
                                {duty.duty_started_at
                                    ? ` since ${clock.format(new Date(duty.duty_started_at))}`
                                    : ''}
                            </span>
                        </p>
                        <p className="mt-1 font-semibold text-stone-900">{duty.event.title}</p>
                        <p className="mt-0.5 text-sm text-pretty text-stone-600">
                            An emergency alerts the DRRMO and the reviewers at once.
                        </p>
                        <EmergencySender assignmentId={duty.id} showList={false} />
                    </div>
                ))
            )}
            <MyEmergencyList />
        </section>
    );
}

function SiteReportsSection() {
    const slots = useQuery({
        queryKey: ['report-slots'],
        queryFn: listReportSlots,
        refetchInterval: 60_000,
    });
    const due = (slots.data ?? []).filter((s) => s.status === 'pending' || s.status === 'overdue');

    return (
        <section aria-labelledby="site-heading" className="mt-8">
            <div className="flex items-baseline justify-between gap-3">
                <h2 id="site-heading" className={eyebrow}>
                    Site reports
                </h2>
                {due.length > 0 && (
                    <p className="text-xs font-semibold text-ember-800 tabular-nums">
                        {due.length} due
                    </p>
                )}
            </div>
            {slots.isPending ? (
                <Skeleton />
            ) : due.length === 0 ? (
                <div className={`${card} p-4`}>
                    <p className="font-medium text-stone-900">No report is due</p>
                    <p className="mt-0.5 text-sm text-pretty text-stone-600">
                        Designated reporters send one every 2 hours while on duty. It shows here
                        when it is due.
                    </p>
                </div>
            ) : (
                <ul className={`${card} divide-y divide-stone-100 overflow-hidden`}>
                    {due.map((slot) => {
                        const late = slot.status === 'overdue';
                        return (
                            <li key={slot.id}>
                                <Link
                                    to={`/me/reports/${slot.id}`}
                                    className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium text-stone-900">
                                            {slot.event ?? 'Event'}
                                        </span>
                                        <span
                                            className={`block text-sm tabular-nums ${late ? 'font-medium text-ember-800' : 'text-stone-600'}`}
                                        >
                                            Due {clock.format(new Date(slot.due_at))}
                                            {late && ' · overdue'}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-sm font-semibold text-maroon-700">
                                        Write
                                    </span>
                                    <ChevronIcon className="-ml-1 size-4 shrink-0 text-maroon-700" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
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
        <section aria-labelledby="review-heading" className="mt-8">
            <h2 id="review-heading" className={eyebrow}>
                Needs attention
            </h2>
            <div className={`${card} divide-y divide-stone-100 overflow-hidden`}>
                <Link
                    to="/me/emergencies"
                    className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
                >
                    <InboxIcon className="size-5 shrink-0 text-stone-500" />
                    <span className="min-w-0 flex-1">
                        <span className="block font-medium text-stone-900">Emergencies</span>
                        <span className="block text-sm text-stone-600 tabular-nums">
                            {!loaded
                                ? 'Loading...'
                                : open.length === 0
                                  ? 'None open'
                                  : `${open.length} open`}
                        </span>
                    </span>
                    {waiting > 0 && (
                        <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 tabular-nums ring-1 ring-red-200 ring-inset">
                            {waiting} not acknowledged
                        </span>
                    )}
                    <ChevronIcon className="size-4 shrink-0 text-stone-400" />
                </Link>

                <div className="px-4 py-3">
                    <p className="font-medium text-stone-900">Late site reports</p>
                    {attention.isPending ? (
                        <p className="mt-0.5 text-sm text-stone-600">Loading...</p>
                    ) : late.length === 0 ? (
                        <p className="mt-0.5 text-sm text-stone-600">No report is late.</p>
                    ) : (
                        <ul className="mt-1">
                            {late.map((r) => (
                                <li key={r.id} className="py-1.5">
                                    <p className="truncate text-sm font-medium text-stone-800">
                                        {r.event ?? 'Event'}
                                    </p>
                                    <p className="text-sm text-stone-600 tabular-nums">
                                        {r.author ?? 'Reporter'} · due {ago(r.due_at, now)} ·{' '}
                                        <span className="text-ember-800">
                                            {r.status === 'missed' ? 'missed' : 'overdue'}
                                        </span>
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
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
                Send an emergency or write the site report that is due.
            </p>

            <div className="mt-6">
                <EmergencySection />
            </div>
            <SiteReportsSection />
            {reviewer && <ReviewSection />}
        </div>
    );
}

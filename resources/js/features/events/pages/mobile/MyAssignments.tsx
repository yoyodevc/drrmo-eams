// M-Duties (S1.5). A marshal or volunteer sees their own duties: event, time, place, duty type.
// Mobile first at 360 px: one column, date block on the left, whole card readable at a glance.
// A List and Calendar switch shows the same duties on a month calendar.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { acknowledgeAssignment, listMyAssignments, type MyAssignment } from '@/features/events/api';
import { DateBlock } from '@/features/events/components/DateBlock';
import {
    PersonalCalendar,
    ShowSwitch,
    useShowCalendar,
} from '@/features/events/components/PersonalCalendar';
import { CheckIcon, ClipboardIcon, ClockIcon, PinIcon } from '@/features/events/components/icons';
import { findLinkedDuty, linkedAssignmentId } from '@/features/events/dutyLink';
import { assignmentStatuses, chipClass } from '@/features/events/format';
import { DutyControl } from '@/features/monitoring/components/DutyControl';
import { ReportDueCard } from '@/features/monitoring/components/ReportDueCard';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function shiftTime(start: Date, end: Date) {
    return start.toDateString() === end.toDateString()
        ? `${clock.format(start)} to ${clock.format(end)}`
        : `${clock.format(start)} to ${shortDay.format(end)}, ${clock.format(end)}`;
}

function DutyCard({
    duty,
    ended = false,
    linked = false,
}: {
    duty: MyAssignment;
    ended?: boolean;
    linked?: boolean;
}) {
    const start = new Date(duty.starts_at);
    const end = new Date(duty.ends_at);
    const cancelled = duty.event.status === 'cancelled' || duty.status === 'cancelled';
    const queryClient = useQueryClient();
    const acknowledge = useMutation({
        mutationFn: () => acknowledgeAssignment(duty.id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-assignments'] }),
    });
    const headingId = `duty-${duty.id}`;

    return (
        <li id={`duty-card-${duty.id}`} className="scroll-mt-20">
            <article
                aria-labelledby={headingId}
                aria-current={linked ? 'true' : undefined}
                className={`h-full rounded-card bg-white ${linked ? 'ring-2 ring-maroon-600' : 'ring-1 ring-stone-200'}`}
            >
                <div className="flex gap-4 p-4">
                    <DateBlock date={start} muted={cancelled || ended} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <p
                                className={`text-sm font-semibold ${cancelled ? 'text-stone-500' : 'text-maroon-700'}`}
                            >
                                {duty.duty_type ?? 'Duty to be confirmed'}
                                {duty.team_needed ? `, ${duty.team_needed}` : ''}
                            </p>
                            {cancelled ? (
                                <span
                                    className={`${chipClass} shrink-0 bg-stone-100 text-stone-600 ring-stone-200`}
                                >
                                    Cancelled
                                </span>
                            ) : (
                                duty.status !== 'assigned' && (
                                    <span
                                        className={`${chipClass} shrink-0 ${assignmentStatuses[duty.status].chip}`}
                                    >
                                        {assignmentStatuses[duty.status].label}
                                    </span>
                                )
                            )}
                        </div>
                        <h3
                            id={headingId}
                            className={`mt-0.5 text-lg leading-snug font-semibold text-balance ${cancelled ? 'text-stone-500' : 'text-stone-900'}`}
                        >
                            {duty.event.title}
                        </h3>
                        <dl className="mt-2 space-y-1.5 text-base text-stone-700">
                            <div className="flex items-start gap-2">
                                <dt className="pt-0.5 text-stone-500">
                                    <ClockIcon className="size-5" />
                                    <span className="sr-only">When</span>
                                </dt>
                                <dd className="tabular-nums">
                                    <span className="sr-only">
                                        {weekday.format(start)}, {shortDay.format(start)},{' '}
                                    </span>
                                    {shiftTime(start, end)}
                                </dd>
                            </div>
                            <div className="flex items-start gap-2">
                                <dt className="pt-0.5 text-stone-500">
                                    <PinIcon className="size-5" />
                                    <span className="sr-only">Where</span>
                                </dt>
                                <dd className="min-w-0">
                                    {duty.event.location ?? 'Place to be confirmed'}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
                {duty.instructions && (
                    <div className="border-t border-stone-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                            Instructions
                        </p>
                        <p className="mt-1 text-base text-pretty whitespace-pre-line text-stone-700">
                            {duty.instructions}
                        </p>
                    </div>
                )}
                {!cancelled && !ended && duty.status === 'assigned' && (
                    <div className="rounded-b-card border-t border-sky-200 bg-sky-50 px-4 py-3">
                        <p className="text-sm text-pretty text-stone-700">
                            Let DRRMO know you have seen this duty and will be there.
                        </p>
                        {acknowledge.isError && (
                            <div className="mt-3">
                                <Alert tone="error">
                                    That did not save. Check your connection and try again.
                                </Alert>
                            </div>
                        )}
                        <Button
                            block
                            className="mt-3"
                            loading={acknowledge.isPending}
                            onClick={() => acknowledge.mutate()}
                        >
                            {acknowledge.isPending ? 'Saving...' : 'Acknowledge duty'}
                        </Button>
                    </div>
                )}
                {!cancelled &&
                    duty.event.status === 'published' &&
                    (!ended || duty.status === 'on_duty') && <DutyControl duty={duty} />}
                {!cancelled && duty.status === 'acknowledged' && duty.acknowledged_at && (
                    <p className="flex items-center gap-2 border-t border-stone-100 px-4 py-3 text-sm text-stone-600">
                        <CheckIcon className="size-4 shrink-0 text-green-700" />
                        <span className="tabular-nums">
                            You acknowledged this on {stamp.format(new Date(duty.acknowledged_at))}.
                        </span>
                    </p>
                )}
            </article>
        </li>
    );
}

function DutyList({
    title,
    duties,
    ended = false,
    linkedId = null,
}: {
    title: string;
    duties: MyAssignment[];
    ended?: boolean;
    linkedId?: number | null;
}) {
    const id = `duties-${title.toLowerCase()}`;
    return (
        <section aria-labelledby={id} className="mt-8">
            <h2 id={id} className="flex items-baseline gap-2 text-lg font-semibold text-stone-900">
                {title}
                <span className="text-sm font-normal text-stone-500 tabular-nums">
                    {duties.length}
                </span>
            </h2>
            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                {duties.map((duty) => (
                    <DutyCard
                        key={duty.id}
                        duty={duty}
                        ended={ended}
                        linked={duty.id === linkedId}
                    />
                ))}
            </ul>
        </section>
    );
}

function Skeleton() {
    return (
        <div className="mt-6 grid gap-3 lg:grid-cols-2" aria-busy="true">
            <p role="status" className="sr-only">
                Loading your duties...
            </p>
            {[0, 1].map((card) => (
                <div
                    key={card}
                    className="flex gap-4 rounded-card bg-white p-4 ring-1 ring-stone-200"
                    aria-hidden="true"
                >
                    <div className="h-18 w-14 shrink-0 animate-pulse rounded-control bg-stone-200" />
                    <div className="flex-1 space-y-2.5">
                        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                        <div className="h-5 w-4/5 animate-pulse rounded bg-stone-200" />
                        <div className="h-4 w-3/5 animate-pulse rounded bg-stone-200" />
                        <div className="h-4 w-2/5 animate-pulse rounded bg-stone-200" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// Dot on the calendar: gray when over or called off, then by where the person stands.
function dutyDot(duty: MyAssignment, now: number) {
    if (duty.event.status === 'cancelled' || duty.status === 'cancelled') return 'bg-stone-300';
    if (new Date(duty.ends_at).getTime() < now) return 'bg-stone-400';
    if (duty.status === 'on_duty') return 'bg-ember-500';
    if (duty.status === 'assigned') return 'bg-sky-600';
    if (duty.status === 'acknowledged') return 'bg-green-600';
    return 'bg-maroon-700';
}

export function MyAssignments() {
    const duties = useQuery({ queryKey: ['my-assignments'], queryFn: listMyAssignments });
    const [params] = useSearchParams();
    const linkedId = linkedAssignmentId(params.get('assignment'));
    // A link from an email always shows the list, because the card is found there.
    const showCalendar = useShowCalendar() && linkedId === null;

    const [now] = useState(() => Date.now());
    const all = duties.data ?? [];
    const live = all.filter((duty) => duty.event.status !== 'cancelled');
    const cancelled = all.filter((duty) => duty.event.status === 'cancelled');
    const upcoming = live.filter((duty) => new Date(duty.ends_at).getTime() >= now);
    const past = live.filter((duty) => new Date(duty.ends_at).getTime() < now).reverse();
    const linked = findLinkedDuty(all, linkedId);
    const toAcknowledge = upcoming.filter((duty) => duty.status === 'assigned').length;

    // Scroll once per linked duty, not on every refetch.
    const linkedDutyId = linked?.duty.id ?? null;
    useEffect(() => {
        if (linkedDutyId === null) return;
        document.getElementById(`duty-card-${linkedDutyId}`)?.scrollIntoView({ block: 'center' });
    }, [linkedDutyId]);

    return (
        <div>
            <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">My duties</h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                Where to be and when, soonest first.
            </p>

            <ReportDueCard />

            {toAcknowledge > 0 && (
                <p
                    className="mt-4 flex items-center gap-2 rounded-control bg-sky-50 px-3 py-2.5 text-sm font-medium text-sky-800 ring-1 ring-sky-200 ring-inset"
                    aria-live="polite"
                >
                    <ClipboardIcon className="size-4 shrink-0" />
                    {toAcknowledge === 1
                        ? '1 duty needs your acknowledgement.'
                        : `${toAcknowledge} duties need your acknowledgement.`}
                </p>
            )}

            {duties.isPending && <Skeleton />}

            {duties.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        Your duties did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={duties.isFetching}
                        onClick={() => void duties.refetch()}
                    >
                        {duties.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {duties.isSuccess && linkedId !== null && !linked && (
                <p
                    className="mt-4 rounded-control bg-stone-100 px-3 py-2.5 text-sm text-stone-700"
                    role="status"
                >
                    That duty is not in your list. It may have been removed.
                </p>
            )}

            {duties.isSuccess && all.length === 0 && (
                <div className="mt-6 flex max-w-2xl flex-col items-center rounded-card bg-white px-6 py-10 text-center ring-1 ring-stone-200 md:py-14">
                    <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <ClipboardIcon className="size-5" />
                    </span>
                    <p className="mt-4 text-lg font-semibold text-stone-900">No duties yet</p>
                    <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                        When DRRMO assigns you to an event, it shows up here.
                    </p>
                </div>
            )}

            {duties.isSuccess && all.length > 0 && <ShowSwitch />}

            {duties.isSuccess && all.length > 0 && showCalendar && (
                <PersonalCalendar
                    items={all}
                    noun="duty"
                    nouns="duties"
                    dotTone={(duty) => dutyDot(duty, now)}
                    renderDay={(onDay) => (
                        <ul className="mt-3 grid gap-3">
                            {onDay.map((duty) => (
                                <DutyCard
                                    key={duty.id}
                                    duty={duty}
                                    ended={new Date(duty.ends_at).getTime() < now}
                                />
                            ))}
                        </ul>
                    )}
                />
            )}

            {duties.isSuccess && all.length > 0 && !showCalendar && (
                <>
                    {upcoming.length > 0 ? (
                        <DutyList title="Upcoming" duties={upcoming} linkedId={linkedId} />
                    ) : (
                        <p className="mt-6 rounded-card bg-white px-4 py-4 text-base text-stone-600 ring-1 ring-stone-200">
                            No upcoming duties.
                        </p>
                    )}
                    {past.length > 0 && (
                        <DutyList title="Past" duties={past} ended linkedId={linkedId} />
                    )}
                    {cancelled.length > 0 && (
                        <details
                            className="group mt-8 border-t border-stone-200 pt-4"
                            open={linked?.cancelled || undefined}
                        >
                            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-control text-base font-semibold text-stone-700 [&::-webkit-details-marker]:hidden">
                                <span>
                                    Cancelled{' '}
                                    <span className="text-sm font-normal text-stone-500 tabular-nums">
                                        {cancelled.length}
                                    </span>
                                </span>
                                <span className="text-sm font-medium text-maroon-700">
                                    <span className="group-open:hidden">Show</span>
                                    <span className="hidden group-open:inline">Hide</span>
                                </span>
                            </summary>
                            <p className="mt-1 text-sm text-stone-600">
                                These events were called off. You do not need to report for them.
                            </p>
                            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                                {cancelled.map((duty) => (
                                    <DutyCard
                                        key={duty.id}
                                        duty={duty}
                                        linked={duty.id === linkedId}
                                    />
                                ))}
                            </ul>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}

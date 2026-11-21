// M-Notices (S2.8). A coordinator reads published events for their department or campus wide.
// Read only. Mobile first at 360 px: one column of cards, two columns from 1024 px.
// A List and Calendar switch shows the same notices on a month calendar.
import { useQuery } from '@tanstack/react-query';
import { listEventNotices, type EventNotice } from '@/features/events/api';
import { DateBlock } from '@/features/events/components/DateBlock';
import {
    PersonalCalendar,
    ShowSwitch,
    useShowCalendar,
} from '@/features/events/components/PersonalCalendar';
import { ClockIcon, MegaphoneIcon, PinIcon } from '@/features/events/components/icons';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function timeRange(start: Date, end: Date) {
    return start.toDateString() === end.toDateString()
        ? `${clock.format(start)} to ${clock.format(end)}`
        : `${clock.format(start)} to ${shortDay.format(end)}, ${clock.format(end)}`;
}

function NoticeCard({ notice }: { notice: EventNotice }) {
    const start = new Date(notice.starts_at);
    const end = new Date(notice.ends_at);
    const headingId = `notice-${notice.id}`;

    return (
        <li>
            <article
                aria-labelledby={headingId}
                className="h-full rounded-card bg-white ring-1 ring-stone-200"
            >
                <div className="flex gap-4 p-4">
                    <DateBlock date={start} />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-maroon-700">
                            {notice.event_type}
                            {notice.campus_wide && (
                                <span className="font-normal text-stone-600"> · Campus wide</span>
                            )}
                        </p>
                        <h2
                            id={headingId}
                            className="mt-0.5 text-lg leading-snug font-semibold text-balance text-stone-900"
                        >
                            {notice.title}
                        </h2>
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
                                    {timeRange(start, end)}
                                </dd>
                            </div>
                            <div className="flex items-start gap-2">
                                <dt className="pt-0.5 text-stone-500">
                                    <PinIcon className="size-5" />
                                    <span className="sr-only">Where</span>
                                </dt>
                                <dd className="min-w-0">
                                    {notice.location ?? 'Place to be confirmed'}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
                {notice.description && (
                    <div className="border-t border-stone-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                            About this event
                        </p>
                        <p className="mt-1 text-base text-pretty whitespace-pre-line text-stone-700">
                            {notice.description}
                        </p>
                    </div>
                )}
            </article>
        </li>
    );
}

function Skeleton() {
    return (
        <div className="mt-6 grid gap-3 lg:grid-cols-2" aria-busy="true">
            <p role="status" className="sr-only">
                Loading event notices...
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

export function EventNotices() {
    const notices = useQuery({ queryKey: ['event-notices'], queryFn: listEventNotices });
    const showCalendar = useShowCalendar();

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Event notices</h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                Upcoming DRRMO events for your department and campus wide, soonest first. For your
                information only.
            </p>

            {notices.isPending && <Skeleton />}

            {notices.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        The notices did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={notices.isFetching}
                        onClick={() => void notices.refetch()}
                    >
                        {notices.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {notices.isSuccess && notices.data.length === 0 && (
                <div className="mt-6 flex max-w-2xl flex-col items-center rounded-card bg-white px-6 py-10 text-center ring-1 ring-stone-200 md:py-14">
                    <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <MegaphoneIcon className="size-5" />
                    </span>
                    <p className="mt-4 text-lg font-semibold text-stone-900">No upcoming events</p>
                    <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                        When DRRMO publishes an event for your department, it shows up here.
                    </p>
                </div>
            )}

            {notices.isSuccess && notices.data.length > 0 && <ShowSwitch />}

            {notices.isSuccess && notices.data.length > 0 && showCalendar && (
                <PersonalCalendar
                    items={notices.data}
                    noun="event"
                    nouns="events"
                    dotTone={() => 'bg-maroon-700'}
                    renderDay={(onDay) => (
                        <ul className="mt-3 grid gap-3">
                            {onDay.map((notice) => (
                                <NoticeCard key={notice.id} notice={notice} />
                            ))}
                        </ul>
                    )}
                />
            )}

            {notices.isSuccess && notices.data.length > 0 && !showCalendar && (
                <ul className="mt-6 grid gap-3 lg:grid-cols-2">
                    {notices.data.map((notice) => (
                        <NoticeCard key={notice.id} notice={notice} />
                    ))}
                </ul>
            )}
        </div>
    );
}

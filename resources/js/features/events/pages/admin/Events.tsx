// A-Events list (SCREENS.md). Admin sees every event, newest first, as a list or a calendar.
// Active events (draft and published) come first. Cancelled and completed ones sit behind their own tabs.
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { listEvents, type EventSummary } from '@/features/events/api';
import { CalendarIcon, ListIcon, PlusIcon, SlidersIcon } from '@/features/events/components/icons';
import { EventsCalendar } from '@/features/events/components/EventsCalendar';
import { chipClass, schedule, statuses } from '@/features/events/format';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';

const headCell = 'px-5 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase';

type View = 'active' | 'cancelled' | 'completed';

const views: { id: View; label: string; empty: string; match: EventSummary['status'][] }[] = [
    {
        id: 'active',
        label: 'Active',
        empty: 'No active events. Drafts and published events show here.',
        match: ['draft', 'published'],
    },
    {
        id: 'completed',
        label: 'Completed',
        empty: 'No completed events yet.',
        match: ['completed'],
    },
    {
        id: 'cancelled',
        label: 'Cancelled',
        empty: 'No cancelled events.',
        match: ['cancelled'],
    },
];

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3].map((row) => (
                <tr key={row} aria-hidden="true">
                    <td className="px-5 py-4">
                        <div className="h-4 w-48 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-4 w-36 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-28 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-5 w-20 animate-pulse rounded-full bg-stone-200" />
                    </td>
                </tr>
            ))}
        </>
    );
}

const displays = [
    { id: 'list', label: 'List', icon: ListIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
] as const;

export function Events() {
    const [params, setParams] = useSearchParams();
    const calendar = params.get('show') === 'calendar';
    const list = useQuery({ queryKey: ['events'], queryFn: listEvents, enabled: !calendar });
    const all = list.data ?? [];
    const view = views.find((v) => v.id === params.get('view')) ?? views[0];
    const count = (v: (typeof views)[number]) =>
        all.filter((event) => v.match.includes(event.status)).length;
    const events = all.filter((event) => view.match.includes(event.status));
    const active = view.id === 'active';

    return (
        <div className="mx-auto max-w-[1440px]">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Events
                    </h1>
                    <p className="mt-1 text-pretty text-stone-600">
                        Campus events that need DRRMO personnel.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div
                        className="inline-flex rounded-control bg-stone-100 p-1"
                        role="group"
                        aria-label="Show events as"
                    >
                        {displays.map((d) => {
                            const selected = (d.id === 'calendar') === calendar;
                            const Icon = d.icon;
                            return (
                                <button
                                    key={d.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() =>
                                        setParams(d.id === 'calendar' ? { show: 'calendar' } : {}, {
                                            replace: true,
                                        })
                                    }
                                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-[6px] px-3 text-sm font-semibold transition-colors ${selected ? 'bg-white text-stone-900 ring-1 ring-stone-200' : 'text-stone-600 hover:text-stone-900'}`}
                                >
                                    <Icon className="size-4" />
                                    {d.label}
                                </button>
                            );
                        })}
                    </div>
                    <Link
                        to="/admin/events/new"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-maroon-700 pr-4 pl-3 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 active:bg-maroon-900"
                    >
                        <PlusIcon />
                        New event
                    </Link>
                </div>
            </header>

            {calendar ? (
                <section className="mt-8" aria-label="Event calendar">
                    <EventsCalendar />
                </section>
            ) : list.isError ? (
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">
                        The events did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        size="md"
                        loading={list.isFetching}
                        onClick={() => void list.refetch()}
                    >
                        {list.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            ) : list.isSuccess && all.length === 0 ? (
                <div className="mt-8 flex flex-col items-center rounded-card bg-white px-6 py-16 text-center ring-1 ring-stone-200">
                    <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <CalendarIcon className="size-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-stone-900">No events yet</h2>
                    <p className="mt-1 max-w-sm text-pretty text-stone-600">
                        Add a campus event, then set how many personnel it needs.
                    </p>
                    <Link
                        to="/admin/events/new"
                        className="mt-6 inline-flex min-h-10 items-center rounded-control border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50"
                    >
                        Create the first event
                    </Link>
                </div>
            ) : (
                <section className="mt-8" aria-busy={list.isPending || undefined}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <SegmentedControl
                            label="Show events"
                            options={views.map((v) => ({
                                id: v.id,
                                label: v.label,
                                count: list.isSuccess ? count(v) : undefined,
                            }))}
                            value={view.id}
                            onChange={(id) =>
                                setParams(id === 'active' ? {} : { view: id }, { replace: true })
                            }
                        />
                        <p className="text-sm text-stone-600" aria-live="polite">
                            {list.isPending
                                ? 'Loading events...'
                                : `${events.length} ${events.length === 1 ? 'event' : 'events'}`}
                        </p>
                    </div>
                    {!active && (
                        <p className="mb-3 text-sm text-stone-600">
                            {view.id === 'cancelled'
                                ? 'Cancelled events are kept for the record. Their duties and people can no longer change.'
                                : 'Completed events are kept for the record and reports.'}
                        </p>
                    )}
                    <div className="overflow-x-auto rounded-card bg-white ring-1 ring-stone-200">
                        <table className="w-full min-w-[880px] text-left">
                            <thead className="border-b border-stone-200">
                                <tr>
                                    <th scope="col" className={headCell}>
                                        Event
                                    </th>
                                    <th scope="col" className={headCell}>
                                        Type
                                    </th>
                                    <th scope="col" className={headCell}>
                                        Location
                                    </th>
                                    <th scope="col" className={headCell}>
                                        Schedule
                                    </th>
                                    <th scope="col" className={headCell}>
                                        Status
                                    </th>
                                    <th scope="col" className={headCell}>
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {list.isPending && <SkeletonRows />}
                                {list.isSuccess && events.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-5 py-10 text-center text-sm text-stone-600"
                                        >
                                            {view.empty}
                                        </td>
                                    </tr>
                                )}
                                {events.map((event) => {
                                    const when = schedule(event.starts_at, event.ends_at);
                                    const status = statuses[event.status];
                                    return (
                                        <tr
                                            key={event.id}
                                            className="transition-colors hover:bg-stone-50"
                                        >
                                            <td className="max-w-md px-5 py-3.5">
                                                <Link
                                                    to={`/admin/events/${event.id}`}
                                                    className={`rounded-sm font-medium underline-offset-2 transition-colors hover:text-maroon-700 hover:underline ${active ? 'text-stone-900' : 'text-stone-600'}`}
                                                >
                                                    {event.title}
                                                </Link>
                                                {event.description && (
                                                    <p className="mt-0.5 truncate text-sm text-stone-500">
                                                        {event.description}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm whitespace-nowrap text-stone-700">
                                                {event.event_type.label}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-stone-700">
                                                {event.location?.name ?? (
                                                    <span className="text-stone-500">Not set</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm whitespace-nowrap tabular-nums">
                                                <p className="text-stone-800">{when.day}</p>
                                                <p className="mt-0.5 text-stone-500">{when.time}</p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`${chipClass} ${status.chip}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                {active ? (
                                                    <Link
                                                        to={`/admin/events/${event.id}`}
                                                        aria-label={`Configure duties and people for ${event.title}`}
                                                        className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 transition-colors hover:border-maroon-700 hover:bg-maroon-50 hover:text-maroon-800"
                                                    >
                                                        <SlidersIcon className="size-4" />
                                                        Configure
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        to={`/admin/events/${event.id}`}
                                                        aria-label={`View ${event.title}`}
                                                        className="inline-flex min-h-9 items-center rounded-control px-3 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                                                    >
                                                        View
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}

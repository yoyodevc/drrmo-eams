// A-Reports, All reports tab (S4.8). Site reports, newest first, with filters by event, place and
// date. Filters sit in the URL so a view can be shared. Under 768 px they fold behind a Filters
// button, like People. A photo opens in a lightbox.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Avatar, ChevronDownIcon, FilterIcon } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { getReportFeed, reportPhotoUrl, type FeedFilters, type FeedReport } from '../../api';
import { nameParts, ReportChip, useNow, when } from '../../components/reportsUi';

// The server sends 15 a page.
const PER_PAGE = 15;
const FILTER_KEYS = ['event_id', 'location_id', 'from', 'to'] as const;

// 48 px and 16 px text on phones so iOS does not zoom; the denser 40 px admin size from 768 px.
const control =
    'block min-h-12 w-full rounded-control border border-stone-300 bg-white px-3 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:text-sm';
const labelClass = 'block min-w-0 text-sm font-medium text-stone-800';

function Select({
    name,
    value,
    onChange,
    children,
}: {
    name: string;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
}) {
    return (
        <label className={labelClass}>
            <span className="mb-1.5 block">{name}</span>
            <span className="relative block">
                <select
                    className={`${control} cursor-pointer appearance-none pr-10`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {children}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
            </span>
        </label>
    );
}

function Lightbox({ report, onClose }: { report: FeedReport | null; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const el = dialog.current;
        if (!el) return;
        if (report && !el.open) el.showModal();
        if (!report && el.open) el.close();
    }, [report]);

    return (
        <dialog
            ref={dialog}
            onClose={onClose}
            onClick={(e) => e.target === dialog.current && onClose()}
            aria-label="Report photo"
            className="m-auto max-h-[90dvh] max-w-[90vw] rounded-card bg-white p-3 shadow-raised backdrop:bg-black/70"
        >
            {report && (
                <div>
                    <img
                        src={reportPhotoUrl(report.id)}
                        alt={`Photo from ${report.author ?? 'the reporter'} at ${report.event.title ?? 'the event'}`}
                        className="max-h-[75dvh] max-w-full rounded-control object-contain"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate pl-1 text-sm text-stone-600">
                            {report.author ?? 'Unknown'} · {report.event.title ?? 'Event'}
                        </p>
                        <Button variant="secondary" size="md" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            )}
        </dialog>
    );
}

function ReportRow({
    report,
    now,
    onPhoto,
}: {
    report: FeedReport;
    now: number;
    onPhoto: () => void;
}) {
    const [first, last] = nameParts(report.author);
    const missed = report.status === 'missed' || !report.summary;

    return (
        <li
            className={`relative px-4 py-4 md:px-5 ${report.status === 'missed' ? 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-red-700' : ''}`}
        >
            <div className="flex gap-3 md:gap-4">
                <div className="hidden sm:block">
                    <Avatar first={first} last={last} dim={missed} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                            <p className="font-semibold text-stone-900">
                                {report.author ?? 'Unknown'}
                            </p>
                            <ReportChip status={report.status} />
                        </div>
                        <p className="text-sm text-stone-500 tabular-nums">
                            {report.submitted_at
                                ? `Sent ${when(report.submitted_at, now)}`
                                : `Due ${when(report.due_at, now)}`}
                        </p>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-600">
                        {report.event.title ?? 'Event'}
                        {report.location && ` · ${report.location}`}
                        {report.submitted_at && (
                            <span className="tabular-nums"> · due {when(report.due_at, now)}</span>
                        )}
                    </p>
                    <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                        <p
                            className={`max-w-3xl min-w-0 flex-1 text-pretty whitespace-pre-wrap ${report.summary ? 'text-base text-stone-800' : 'text-sm text-stone-500'}`}
                        >
                            {report.summary ?? 'No report was sent for this slot.'}
                        </p>
                        {report.has_photo && (
                            <button
                                type="button"
                                onClick={onPhoto}
                                className="shrink-0 self-start overflow-hidden rounded-control ring-1 ring-stone-200 transition hover:ring-stone-400 focus:ring-2 focus:ring-maroon-700 focus:outline-none"
                            >
                                <span className="sr-only">
                                    Open the photo from {report.author ?? 'this report'}
                                </span>
                                <img
                                    src={reportPhotoUrl(report.id)}
                                    alt=""
                                    loading="lazy"
                                    className="h-24 w-32 object-cover"
                                />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </li>
    );
}

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3].map((row) => (
                <li key={row} aria-hidden="true" className="flex gap-4 px-4 py-4 md:px-5">
                    <div className="hidden size-10 animate-pulse rounded-full bg-stone-200 sm:block" />
                    <div className="flex-1">
                        <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-stone-200" />
                        <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-stone-200" />
                    </div>
                </li>
            ))}
        </>
    );
}

export function ReportFeed() {
    const now = useNow();
    const [params, setParams] = useSearchParams();
    const filters: FeedFilters = {
        event_id: params.get('event_id') ?? '',
        location_id: params.get('location_id') ?? '',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
    };
    const page = Math.max(1, Number(params.get('page')) || 1);
    const [photoOf, setPhotoOf] = useState<FeedReport | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const feed = useQuery({
        queryKey: ['report-feed', filters, page],
        queryFn: () => getReportFeed(filters, page),
        placeholderData: keepPreviousData,
    });

    function change(key: keyof FeedFilters, value: string) {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete('page');
        setParams(next, { replace: true });
    }

    function goTo(target: number) {
        const next = new URLSearchParams(params);
        next.set('page', String(target));
        setParams(next);
    }

    function clear() {
        setParams(new URLSearchParams(), { replace: true });
    }

    const rows = feed.data?.data ?? [];
    const lastPage = feed.data?.meta.last_page ?? 1;
    const total = feed.data?.meta.total ?? 0;
    const active = FILTER_KEYS.filter((key) => filters[key] !== '').length;
    const first = (page - 1) * PER_PAGE + 1;
    const last = first + rows.length - 1;

    return (
        <div>
            <form role="search" aria-label="Filter reports" onSubmit={(e) => e.preventDefault()}>
                <button
                    type="button"
                    aria-expanded={showFilters}
                    aria-controls="feed-filters"
                    onClick={() => setShowFilters((open) => !open)}
                    className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control border px-4 text-base font-semibold transition-colors md:hidden ${showFilters || active > 0 ? 'border-maroon-700 bg-maroon-50 text-maroon-800' : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50'}`}
                >
                    <FilterIcon className="size-5" />
                    Filters
                    {active > 0 && (
                        <span className="text-sm tabular-nums">
                            <span className="sr-only">, </span>
                            {active}
                            <span className="sr-only"> on</span>
                        </span>
                    )}
                </button>
                <div
                    id="feed-filters"
                    className={`${showFilters ? 'mt-3 grid' : 'hidden'} grid-cols-2 gap-3 md:mt-0 md:grid md:grid-cols-4 md:items-end`}
                >
                    <div className="col-span-2 md:col-span-1">
                        <Select
                            name="Event"
                            value={filters.event_id}
                            onChange={(v) => change('event_id', v)}
                        >
                            <option value="">All events</option>
                            {feed.data?.filters.events.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.title}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <Select
                            name="Place"
                            value={filters.location_id}
                            onChange={(v) => change('location_id', v)}
                        >
                            <option value="">All places</option>
                            {feed.data?.filters.locations.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <label className={labelClass}>
                        <span className="mb-1.5 block">From</span>
                        <input
                            type="date"
                            className={control}
                            value={filters.from}
                            max={filters.to || undefined}
                            onChange={(e) => change('from', e.target.value)}
                        />
                    </label>
                    <label className={labelClass}>
                        <span className="mb-1.5 block">To</span>
                        <input
                            type="date"
                            className={control}
                            value={filters.to}
                            min={filters.from || undefined}
                            onChange={(e) => change('to', e.target.value)}
                        />
                    </label>
                </div>
            </form>

            {feed.isError && (
                <div className="mt-4 max-w-xl space-y-3">
                    <Alert tone="error">{feed.error.message}</Alert>
                    <Button variant="secondary" size="md" onClick={() => void feed.refetch()}>
                        Retry
                    </Button>
                </div>
            )}

            <div className="mt-6 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                <div className="relative flex min-h-14 items-center justify-between gap-3 border-b border-stone-200 px-4 md:min-h-12 md:px-5">
                    <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
                        {feed.isPending ? (
                            'Loading reports...'
                        ) : total > 0 ? (
                            <>
                                Showing {first} to {last} of {total}
                                <span className="max-sm:hidden">, newest first</span>
                            </>
                        ) : (
                            '0 reports'
                        )}
                    </p>
                    {/* Always in the layout so a filter never moves anything. */}
                    <button
                        type="button"
                        onClick={clear}
                        disabled={active === 0}
                        tabIndex={active > 0 ? 0 : -1}
                        aria-hidden={active === 0 || undefined}
                        className={`inline-flex min-h-12 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline md:min-h-8 ${active > 0 ? '' : 'invisible'}`}
                    >
                        Clear filters{active > 0 ? ` (${active})` : ''}
                    </button>
                    <div
                        aria-hidden="true"
                        className={`absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-maroon-700/10 transition-opacity ${feed.isFetching && !feed.isPending ? 'opacity-100' : 'opacity-0'}`}
                    >
                        <div className="h-full w-1/3 animate-pulse bg-maroon-700/60" />
                    </div>
                </div>

                {feed.isPending ? (
                    <ul className="divide-y divide-stone-100">
                        <SkeletonRows />
                    </ul>
                ) : rows.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
                        <p className="font-semibold text-stone-900">
                            {active > 0 ? 'No reports match these filters' : 'No reports yet'}
                        </p>
                        <p className="mt-1 text-sm text-stone-600">
                            {active > 0
                                ? 'Try another event or a wider date range.'
                                : 'Site reports from people on duty show up here once they fall due.'}
                        </p>
                        {active > 0 && (
                            <button
                                type="button"
                                onClick={clear}
                                className="mt-2 inline-flex min-h-12 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline md:min-h-0"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y divide-stone-100">
                        {rows.map((report) => (
                            <ReportRow
                                key={report.id}
                                report={report}
                                now={now}
                                onPhoto={() => setPhotoOf(report)}
                            />
                        ))}
                    </ul>
                )}

                {lastPage > 1 && (
                    <nav
                        className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 md:px-5"
                        aria-label="Pages"
                    >
                        <Button
                            variant="secondary"
                            size="md"
                            className="max-md:min-h-12"
                            disabled={page <= 1}
                            onClick={() => goTo(page - 1)}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-stone-600 tabular-nums">
                            Page {page} of {lastPage}
                        </span>
                        <Button
                            variant="secondary"
                            size="md"
                            className="max-md:min-h-12"
                            disabled={page >= lastPage}
                            onClick={() => goTo(page + 1)}
                        >
                            Next
                        </Button>
                    </nav>
                )}
            </div>

            <Lightbox report={photoOf} onClose={() => setPhotoOf(null)} />
        </div>
    );
}

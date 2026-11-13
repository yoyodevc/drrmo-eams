// A-Report feed (S4.8). Site reports, newest first, with filters by event, place and date.
// Desktop first. Filters sit in the URL so a view can be shared. A photo opens in a lightbox.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { getReportFeed, reportPhotoUrl, type FeedFilters, type FeedReport } from '../../api';

const control =
    'min-h-10 rounded-control border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-maroon-700 focus:outline-none';
const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

const badges: Record<string, { label: string; chip: string } | undefined> = {
    late: { label: 'Late', chip: 'bg-amber-50 text-amber-900 ring-amber-200' },
    overdue: { label: 'Overdue', chip: 'bg-red-50 text-red-800 ring-red-200' },
};

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
            className="m-auto max-h-[90dvh] max-w-[90vw] rounded-card bg-white p-3 backdrop:bg-black/70"
        >
            {report && (
                <div>
                    <img
                        src={reportPhotoUrl(report.id)}
                        alt={`Photo from ${report.author ?? 'the reporter'} at ${report.event.title ?? 'the event'}`}
                        className="max-h-[75dvh] max-w-full rounded-control object-contain"
                    />
                    <div className="mt-3 flex justify-end">
                        <Button variant="secondary" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            )}
        </dialog>
    );
}

function ReportCard({ report, onPhoto }: { report: FeedReport; onPhoto: () => void }) {
    const badge = badges[report.status];

    return (
        <li className="rounded-card bg-white p-4 ring-1 ring-stone-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-stone-900">{report.event.title}</p>
                {badge && (
                    <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.chip}`}
                    >
                        {badge.label}
                    </span>
                )}
            </div>
            <p className="mt-0.5 text-sm text-stone-600">
                {report.author ?? 'Unknown'} · {report.location ?? 'No place'} · due{' '}
                {stamp.format(new Date(report.due_at))}
                {report.submitted_at && `, sent ${stamp.format(new Date(report.submitted_at))}`}
            </p>
            <div className="mt-3 flex gap-4">
                <p className="min-w-0 flex-1 text-base whitespace-pre-wrap text-stone-800">
                    {report.summary ?? (
                        <span className="text-stone-500">No report was sent for this slot.</span>
                    )}
                </p>
                {report.has_photo && (
                    <button
                        type="button"
                        onClick={onPhoto}
                        className="shrink-0 overflow-hidden rounded-control ring-1 ring-stone-300 focus:ring-2 focus:ring-maroon-700 focus:outline-none"
                        aria-label="Open photo"
                    >
                        <img
                            src={reportPhotoUrl(report.id)}
                            alt=""
                            loading="lazy"
                            className="size-24 object-cover"
                        />
                    </button>
                )}
            </div>
        </li>
    );
}

export function ReportFeed() {
    const [params, setParams] = useSearchParams();
    const filters: FeedFilters = {
        event_id: params.get('event_id') ?? '',
        location_id: params.get('location_id') ?? '',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
    };
    const page = Math.max(1, Number(params.get('page')) || 1);
    const [photoOf, setPhotoOf] = useState<FeedReport | null>(null);

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

    const rows = feed.data?.data ?? [];
    const lastPage = feed.data?.meta.last_page ?? 1;

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Reports</h1>
            <p className="mt-1 text-stone-600">Site reports from the field, newest first.</p>

            <form
                className="mt-6 flex flex-wrap items-end gap-4"
                onSubmit={(e) => e.preventDefault()}
            >
                <label className="flex flex-col gap-1 text-sm font-medium text-stone-800">
                    Event
                    <select
                        className={control}
                        value={filters.event_id}
                        onChange={(e) => change('event_id', e.target.value)}
                    >
                        <option value="">All events</option>
                        {feed.data?.filters.events.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.title}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-stone-800">
                    Place
                    <select
                        className={control}
                        value={filters.location_id}
                        onChange={(e) => change('location_id', e.target.value)}
                    >
                        <option value="">All places</option>
                        {feed.data?.filters.locations.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-stone-800">
                    From
                    <input
                        type="date"
                        className={control}
                        value={filters.from}
                        onChange={(e) => change('from', e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-stone-800">
                    To
                    <input
                        type="date"
                        className={control}
                        value={filters.to}
                        onChange={(e) => change('to', e.target.value)}
                    />
                </label>
            </form>

            {feed.isError && (
                <div className="mt-4">
                    <Alert tone="error">{feed.error.message}</Alert>
                </div>
            )}

            {feed.isPending ? (
                <p className="mt-6 text-stone-600">Loading...</p>
            ) : rows.length === 0 ? (
                <p className="mt-6 text-stone-600">No reports match these filters.</p>
            ) : (
                <ul className="mt-6 grid max-w-4xl gap-3">
                    {rows.map((report) => (
                        <ReportCard
                            key={report.id}
                            report={report}
                            onPhoto={() => setPhotoOf(report)}
                        />
                    ))}
                </ul>
            )}

            {lastPage > 1 && (
                <nav className="mt-6 flex items-center gap-4" aria-label="Pages">
                    <Button variant="secondary" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                        Previous
                    </Button>
                    <span className="text-sm text-stone-600 tabular-nums">
                        Page {page} of {lastPage}
                    </span>
                    <Button
                        variant="secondary"
                        disabled={page >= lastPage}
                        onClick={() => goTo(page + 1)}
                    >
                        Next
                    </Button>
                </nav>
            )}

            <Lightbox report={photoOf} onClose={() => setPhotoOf(null)} />
        </div>
    );
}

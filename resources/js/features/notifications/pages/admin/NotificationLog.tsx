// A-Notification log (S3.6). Every email the system sent or tried to send, newest first.
// Desktop first at 1280 px. Filters sit in the URL so a view can be shared. Failed rows have a Retry.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import {
    listNotifications,
    retryNotification,
    type NotificationFilters,
    type NotificationPage,
} from '../../api';
import { statusChips, typeLabels, usageLevel, when } from '../../format';
import {
    AssignedIcon,
    CancelledIcon,
    ChangedIcon,
    ChevronDownIcon,
    ClockIcon,
    MailIcon,
    RefreshIcon,
    SearchIcon,
} from '../../components/icons';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const PER_PAGE = 25;

const headCell = 'px-5 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase';
const chip =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset';
const control =
    'min-h-10 rounded-control border border-stone-300 bg-white px-3 text-sm text-stone-900 transition-colors focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none';
const label = 'text-sm font-medium text-stone-800';

const typeIcons: Record<string, ComponentType<{ className?: string }>> = {
    'assignment.created': AssignedIcon,
    'assignment.changed': ChangedIcon,
    'assignment.cancelled': CancelledIcon,
};

const statusTabs = [
    { value: '', label: 'All' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
    { value: 'queued', label: 'Queued' },
];

const levels = {
    ok: { bar: 'bg-green-600', note: 'text-stone-500' },
    near: { bar: 'bg-amber-500', note: 'font-medium text-amber-900' },
    over: { bar: 'bg-red-600', note: 'font-medium text-red-800' },
} as const;

function UsageCard({ summary }: { summary: NotificationPage['summary'] | undefined }) {
    if (!summary) {
        return (
            <div
                className="h-[118px] w-full max-w-xs animate-pulse rounded-card bg-stone-200"
                aria-hidden="true"
            />
        );
    }
    const { sent_today: sent, daily_limit: limit } = summary;
    const level = usageLevel(sent, limit);
    const pct = limit > 0 ? Math.min(100, Math.round((sent / limit) * 100)) : 0;
    const left = Math.max(0, limit - sent);

    return (
        <section
            aria-labelledby="usage-title"
            className="w-full max-w-xs rounded-card bg-white p-4 ring-1 ring-stone-200"
        >
            <h2 id="usage-title" className="text-sm font-medium text-stone-700">
                Emails sent today
            </h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 tabular-nums">
                {sent}
                <span className="text-sm font-normal tracking-normal text-stone-500">
                    {' '}
                    of {limit}
                </span>
            </p>
            <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"
                role="progressbar"
                aria-label="Emails sent today against the daily limit"
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-valuenow={sent}
            >
                <div
                    className={`h-full rounded-full transition-[width] duration-200 ${levels[level].bar}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className={`mt-2 text-xs tabular-nums ${levels[level].note}`}>
                {level === 'over' ? 'Limit reached.' : `${left} left.`} Resets at midnight, Manila
                time.
            </p>
        </section>
    );
}

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3, 4].map((row) => (
                <tr key={row} aria-hidden="true">
                    <td className="px-5 py-4">
                        <div className="h-4 w-36 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-4 w-44 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-5 w-16 animate-pulse rounded-full bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-4 w-28 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4" />
                </tr>
            ))}
        </>
    );
}

export function NotificationLog() {
    const [params, setParams] = useSearchParams();
    const filters: NotificationFilters = {
        type: params.get('type') ?? '',
        status: params.get('status') ?? '',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
        search: params.get('search') ?? '',
        page: Number(params.get('page')) || 1,
    };
    const client = useQueryClient();
    const list = useQuery({
        queryKey: ['notifications', filters],
        queryFn: () => listNotifications(filters),
        placeholderData: keepPreviousData,
    });
    const retry = useMutation({
        mutationFn: retryNotification,
        onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
    });

    const set = (key: keyof NotificationFilters, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        setParams(next, { replace: true });
    };
    const clear = () => setParams({}, { replace: true });
    const filtered = Object.entries(filters).some(([k, v]) => k !== 'page' && v);
    const rows = list.data?.data ?? [];
    const summary = list.data?.summary;
    const meta = list.data?.meta;
    const level = summary ? usageLevel(summary.sent_today, summary.daily_limit) : 'ok';
    const neverSent = list.isSuccess && !filtered && (meta?.total ?? 0) === 0;
    const first = meta ? (meta.current_page - 1) * PER_PAGE + 1 : 0;
    const last = meta ? Math.min(meta.total, first + rows.length - 1) : 0;

    return (
        <div className="mx-auto max-w-[1440px]">
            <header className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Notifications
                    </h1>
                    <p className="mt-1 max-w-xl text-pretty text-stone-600">
                        Every duty email the system sent or tried to send. Retry the ones that
                        failed.
                    </p>
                </div>
                {!list.isError && <UsageCard summary={summary} />}
            </header>

            {level !== 'ok' && summary && (
                <div className="mt-6 max-w-2xl">
                    <Alert tone={level === 'over' ? 'error' : 'warning'}>
                        {level === 'over'
                            ? 'The daily email limit is reached. New emails may be refused until midnight. Retry failed ones tomorrow.'
                            : 'Today is close to the daily email limit. Avoid bulk changes to duties until tomorrow.'}
                    </Alert>
                </div>
            )}

            {list.isError ? (
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">
                        The log did not load. Check your connection and try again.
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
            ) : neverSent ? (
                <div className="mt-8 flex flex-col items-center rounded-card bg-white px-6 py-16 text-center ring-1 ring-stone-200">
                    <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <MailIcon className="size-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-stone-900">No emails yet</h2>
                    <p className="mt-1 max-w-sm text-pretty text-stone-600">
                        Emails show here when people are assigned to a duty, moved, or when an event
                        is cancelled.
                    </p>
                </div>
            ) : (
                <section className="mt-8" aria-busy={list.isPending || undefined}>
                    <form
                        className="flex flex-wrap items-end gap-3"
                        role="search"
                        aria-label="Filter notifications"
                        onSubmit={(e) => e.preventDefault()}
                    >
                        <div className="flex flex-col">
                            <span className={`${label} mb-1.5`} id="status-filter">
                                Status
                            </span>
                            <div
                                className="inline-flex rounded-control bg-stone-100 p-1"
                                role="group"
                                aria-labelledby="status-filter"
                            >
                                {statusTabs.map((tab) => {
                                    const selected = filters.status === tab.value;
                                    return (
                                        <button
                                            key={tab.label}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => set('status', tab.value)}
                                            className={`inline-flex min-h-8 items-center rounded-[6px] px-3 text-sm font-semibold transition-colors ${selected ? 'bg-white text-stone-900 ring-1 ring-stone-200' : 'text-stone-600 hover:text-stone-900'}`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <label className={label}>
                            <span className="mb-1.5 block">Email type</span>
                            <span className="relative block">
                                <select
                                    className={`${control} cursor-pointer appearance-none pr-10`}
                                    value={filters.type}
                                    onChange={(e) => set('type', e.target.value)}
                                >
                                    <option value="">All types</option>
                                    {Object.entries(typeLabels).map(([value, text]) => (
                                        <option key={value} value={value}>
                                            {text}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
                            </span>
                        </label>
                        <label className={label}>
                            <span className="mb-1.5 block">From</span>
                            <input
                                type="date"
                                className={control}
                                value={filters.from}
                                max={filters.to || undefined}
                                onChange={(e) => set('from', e.target.value)}
                            />
                        </label>
                        <label className={label}>
                            <span className="mb-1.5 block">To</span>
                            <input
                                type="date"
                                className={control}
                                value={filters.to}
                                min={filters.from || undefined}
                                onChange={(e) => set('to', e.target.value)}
                            />
                        </label>
                        <label className={`${label} min-w-56 flex-1 basis-56`}>
                            <span className="mb-1.5 block">Person</span>
                            <span className="relative block">
                                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-500" />
                                <input
                                    type="search"
                                    className={`${control} w-full pl-9`}
                                    placeholder="Name or email"
                                    value={filters.search}
                                    onChange={(e) => set('search', e.target.value)}
                                />
                            </span>
                        </label>
                        {filtered && (
                            <Button variant="ghost" size="md" type="button" onClick={clear}>
                                Clear filters
                            </Button>
                        )}
                    </form>

                    {retry.isError && (
                        <div className="mt-4 max-w-xl">
                            <Alert tone="error">
                                The retry did not go through. Try again in a moment.
                            </Alert>
                        </div>
                    )}
                    {retry.isSuccess && (
                        <div className="mt-4 max-w-xl">
                            <Alert tone="success">
                                The email is queued again. Its status updates here.
                            </Alert>
                        </div>
                    )}

                    <div className="mt-6 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3">
                            <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
                                {list.isPending
                                    ? 'Loading emails...'
                                    : meta && meta.total > 0
                                      ? `Showing ${first} to ${last} of ${meta.total}`
                                      : '0 emails'}
                            </p>
                            {list.isFetching && !list.isPending && (
                                <p className="text-sm text-stone-500">Updating...</p>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[960px] text-left">
                                <thead className="border-b border-stone-200">
                                    <tr>
                                        <th scope="col" className={headCell}>
                                            Person
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Email
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Event
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Status
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Created
                                        </th>
                                        <th scope="col" className={headCell}>
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {list.isPending && <SkeletonRows />}
                                    {list.isSuccess && rows.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-12 text-center">
                                                <p className="text-stone-700">
                                                    No emails match these filters.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={clear}
                                                    className="mt-2 rounded-sm text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline"
                                                >
                                                    Clear filters
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((n) => {
                                        const status = statusChips[n.status];
                                        const TypeIcon =
                                            typeIcons[n.type] ??
                                            (n.type.startsWith('reminder.') ? ClockIcon : MailIcon);
                                        const name = n.recipient?.name ?? 'this person';
                                        return (
                                            <tr
                                                key={n.id}
                                                className="align-top transition-colors hover:bg-stone-50"
                                            >
                                                <td className="px-5 py-3.5">
                                                    <p
                                                        className={`font-medium ${n.recipient ? 'text-stone-900' : 'text-stone-500'}`}
                                                    >
                                                        {n.recipient?.name ?? 'Removed person'}
                                                    </p>
                                                    {n.recipient && (
                                                        <p className="mt-0.5 text-sm text-stone-500">
                                                            {n.recipient.email}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm whitespace-nowrap text-stone-700">
                                                    <span className="inline-flex items-center gap-2">
                                                        <TypeIcon className="size-4 text-stone-500" />
                                                        {typeLabels[n.type] ?? n.type}
                                                    </span>
                                                </td>
                                                <td className="max-w-xs px-5 py-3.5 text-sm text-stone-700">
                                                    {n.event ?? (
                                                        <span className="text-stone-500">
                                                            No event
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`${chip} ${status.chip}`}>
                                                        {status.label}
                                                    </span>
                                                    {n.status === 'sent' && (
                                                        <p className="mt-1 text-xs text-stone-500 tabular-nums">
                                                            Delivered {when(n.sent_at)}
                                                        </p>
                                                    )}
                                                    {n.status === 'failed' && n.last_error && (
                                                        <p
                                                            className="mt-1 line-clamp-2 max-w-xs text-xs text-red-800"
                                                            title={n.last_error}
                                                        >
                                                            {n.last_error}
                                                        </p>
                                                    )}
                                                    {n.attempts > 1 && (
                                                        <p className="mt-1 text-xs text-stone-500 tabular-nums">
                                                            {n.attempts} attempts
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm whitespace-nowrap text-stone-700 tabular-nums">
                                                    {when(n.created_at)}
                                                </td>
                                                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                    {n.status === 'failed' && (
                                                        <Button
                                                            variant="secondary"
                                                            size="md"
                                                            loading={
                                                                retry.isPending &&
                                                                retry.variables === n.id
                                                            }
                                                            aria-label={`Retry the email to ${name}`}
                                                            onClick={() => retry.mutate(n.id)}
                                                        >
                                                            {!(
                                                                retry.isPending &&
                                                                retry.variables === n.id
                                                            ) && <RefreshIcon className="size-4" />}
                                                            {retry.isPending &&
                                                            retry.variables === n.id
                                                                ? 'Retrying...'
                                                                : 'Retry'}
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {meta && meta.last_page > 1 && (
                            <nav
                                aria-label="Pages"
                                className="flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-3"
                            >
                                <Button
                                    variant="secondary"
                                    size="md"
                                    disabled={meta.current_page <= 1}
                                    onClick={() => set('page', String(meta.current_page - 1))}
                                >
                                    Previous
                                </Button>
                                <p className="text-sm text-stone-600 tabular-nums">
                                    Page {meta.current_page} of {meta.last_page}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    disabled={meta.current_page >= meta.last_page}
                                    onClick={() => set('page', String(meta.current_page + 1))}
                                >
                                    Next
                                </Button>
                            </nav>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

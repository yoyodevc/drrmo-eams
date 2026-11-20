// Records: the audit log viewer (S6.1). Read only. Filters sit in the URL so a view can be shared.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router';
import { listAuditLogs, type AuditFilters } from '../../api';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const PER_PAGE = 25;
const headCell = 'px-5 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase';
const control =
    'min-h-10 rounded-control border border-stone-300 bg-white px-3 text-sm text-stone-900 transition-colors focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none';
const label = 'text-sm font-medium text-stone-800';

const stamp = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'medium',
});

export function AuditLog() {
    const [params, setParams] = useSearchParams();
    const filters: AuditFilters = {
        actor: params.get('actor') ?? '',
        action: params.get('action') ?? '',
        entity: params.get('entity') ?? '',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
        page: Number(params.get('page')) || 1,
    };
    const [open, setOpen] = useState<number | null>(null);
    const list = useQuery({
        queryKey: ['audit-logs', filters],
        queryFn: () => listAuditLogs(filters),
        placeholderData: keepPreviousData,
    });

    const set = (key: keyof AuditFilters, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        setParams(next, { replace: true });
    };
    const filtered = Object.entries(filters).some(([k, v]) => k !== 'page' && v);
    const rows = list.data?.data ?? [];
    const meta = list.data?.meta;
    const first = meta ? (meta.current_page - 1) * PER_PAGE + 1 : 0;
    const last = meta ? Math.min(meta.total, first + rows.length - 1) : 0;

    return (
        <div className="mx-auto max-w-[1440px]">
            <header>
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    Records
                </h1>
                <p className="mt-1 max-w-xl text-pretty text-stone-600">
                    The audit log. Who did what and when. Rows cannot be changed or deleted.
                </p>
            </header>

            {list.isError ? (
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">
                        The audit log did not load. Check your connection and try again.
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
            ) : (
                <section className="mt-8" aria-busy={list.isPending || undefined}>
                    <form
                        className="flex flex-wrap items-end gap-3"
                        role="search"
                        aria-label="Filter the audit log"
                        onSubmit={(e) => e.preventDefault()}
                    >
                        <label className={`${label} min-w-48 flex-1 basis-48`}>
                            <span className="mb-1.5 block">Actor</span>
                            <input
                                type="search"
                                className={`${control} w-full`}
                                placeholder="Name or email"
                                value={filters.actor}
                                onChange={(e) => set('actor', e.target.value)}
                            />
                        </label>
                        <label className={`${label} min-w-48 flex-1 basis-48`}>
                            <span className="mb-1.5 block">Action</span>
                            <input
                                type="search"
                                className={`${control} w-full`}
                                placeholder="Starts with, e.g. grant."
                                value={filters.action}
                                onChange={(e) => set('action', e.target.value)}
                            />
                        </label>
                        <label className={label}>
                            <span className="mb-1.5 block">Entity</span>
                            <select
                                className={`${control} cursor-pointer`}
                                value={filters.entity}
                                onChange={(e) => set('entity', e.target.value)}
                            >
                                <option value="">All entities</option>
                                {(list.data?.entities ?? []).map((entity) => (
                                    <option key={entity} value={entity}>
                                        {entity}
                                    </option>
                                ))}
                            </select>
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
                        {filtered && (
                            <Button
                                variant="ghost"
                                size="md"
                                type="button"
                                onClick={() => setParams({}, { replace: true })}
                            >
                                Clear filters
                            </Button>
                        )}
                    </form>

                    <div className="mt-6 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        <div className="border-b border-stone-200 px-5 py-3">
                            <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
                                {list.isPending
                                    ? 'Loading...'
                                    : meta && meta.total > 0
                                      ? `Showing ${first} to ${last} of ${meta.total}`
                                      : '0 entries'}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px] text-left">
                                <thead className="border-b border-stone-200">
                                    <tr>
                                        <th scope="col" className={headCell}>
                                            When
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Actor
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Action
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Entity
                                        </th>
                                        <th scope="col" className={headCell}>
                                            <span className="sr-only">Details</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {list.isSuccess && rows.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-5 py-12 text-center text-stone-700"
                                            >
                                                No entries match these filters.
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((row) => {
                                        const expanded = open === row.id;
                                        return (
                                            <Fragment key={row.id}>
                                                <tr className="align-top transition-colors hover:bg-stone-50">
                                                    <td className="px-5 py-3.5 text-sm whitespace-nowrap text-stone-700 tabular-nums">
                                                        {stamp.format(new Date(row.created_at))}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <p className="font-medium text-stone-900">
                                                            {row.actor?.name ?? 'System'}
                                                        </p>
                                                        {row.actor && (
                                                            <p className="mt-0.5 text-sm text-stone-500">
                                                                {row.actor.email}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5 font-mono text-sm text-stone-800">
                                                        {row.action}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-sm text-stone-700">
                                                        {row.entity}
                                                        {row.entity_id !== null &&
                                                            ` #${row.entity_id}`}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right">
                                                        <button
                                                            type="button"
                                                            aria-expanded={expanded}
                                                            onClick={() =>
                                                                setOpen(expanded ? null : row.id)
                                                            }
                                                            className="rounded-sm text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline"
                                                        >
                                                            {expanded ? 'Hide' : 'Details'}
                                                            <span className="sr-only">
                                                                {' '}
                                                                for {row.action}
                                                            </span>
                                                        </button>
                                                    </td>
                                                </tr>
                                                {expanded && (
                                                    <tr className="bg-stone-50">
                                                        <td colSpan={5} className="px-5 py-4">
                                                            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
                                                                <dt className="text-stone-500">
                                                                    IP address
                                                                </dt>
                                                                <dd className="text-stone-800">
                                                                    {row.ip_address ?? 'None'}
                                                                </dd>
                                                                <dt className="text-stone-500">
                                                                    Details
                                                                </dt>
                                                                <dd>
                                                                    {row.meta ? (
                                                                        <pre className="overflow-x-auto rounded-control bg-white p-3 font-mono text-xs text-stone-800 ring-1 ring-stone-200">
                                                                            {JSON.stringify(
                                                                                row.meta,
                                                                                null,
                                                                                2,
                                                                            )}
                                                                        </pre>
                                                                    ) : (
                                                                        <span className="text-stone-500">
                                                                            No extra details
                                                                        </span>
                                                                    )}
                                                                </dd>
                                                            </dl>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {meta && meta.last_page > 1 && (
                            <div className="flex items-center justify-between border-t border-stone-200 px-5 py-3">
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
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

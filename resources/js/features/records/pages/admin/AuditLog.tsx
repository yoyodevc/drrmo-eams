// Records: the audit log viewer (S6.1). Read only. Filters sit in the URL so a view can be shared.
// Desktop first at 1280 px with a table grouped by day, where a click on a row opens its details.
// Under 768 px the rows become a tappable list and the filters fold behind a Filters button.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { listAuditLogs, type AuditFilters, type AuditRow } from '../../api';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const PER_PAGE = 25;
const MORE_FILTERS = ['action', 'entity', 'from', 'to'] as const;

const headCell =
    'px-5 py-3 whitespace-nowrap text-xs font-semibold tracking-wide text-stone-500 uppercase';
// 48 px and 16 px text on phones so iOS does not zoom; the denser 40 px admin size from 768 px.
const control =
    'block min-h-12 w-full min-w-0 rounded-control border border-stone-300 bg-white px-3 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:text-sm';
const label = 'block min-w-0 text-sm font-medium text-stone-800';

// Times are shown in Asia/Manila, like the rest of the records.
const zone = 'Asia/Manila';
const timeOf = new Intl.DateTimeFormat('en-PH', { timeZone: zone, timeStyle: 'medium' });
const fullStamp = new Intl.DateTimeFormat('en-PH', {
    timeZone: zone,
    dateStyle: 'full',
    timeStyle: 'medium',
});
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: zone });
const dayLabel = new Intl.DateTimeFormat('en-PH', {
    timeZone: zone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

// "Today", "Yesterday" or "Thu, Nov 19, 2026".
function dayName(iso: string): string {
    const key = dayKey.format(new Date(iso));
    const today = new Date();
    if (key === dayKey.format(today)) return 'Today';
    if (key === dayKey.format(new Date(today.getTime() - 86_400_000))) return 'Yesterday';
    return dayLabel.format(new Date(iso));
}

// Rows come newest first, so one pass splits them into days.
function byDay(rows: AuditRow[]): { day: string; rows: AuditRow[] }[] {
    const groups: { day: string; rows: AuditRow[] }[] = [];
    for (const row of rows) {
        const day = dayName(row.created_at);
        const last = groups.at(-1);
        if (last?.day === day) last.rows.push(row);
        else groups.push({ day, rows: [row] });
    }
    return groups;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return (
        (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
    ).toUpperCase();
}

function entityOf(row: AuditRow): string {
    return row.entity_id !== null ? `${row.entity} #${row.entity_id}` : row.entity;
}

// "role_id" reads "Role id".
function keyLabel(key: string): string {
    const words = key.replace(/[_.]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function valueText(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'None';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

// Line icons, 24 px grid, 1.8 stroke (DESIGN_SYSTEM.md section 6).
function Icon({ className = 'size-5', children }: { className?: string; children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}
const SearchIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
    </Icon>
);
const FilterIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="M4 6h16M7 12h10M10 18h4" />
    </Icon>
);
const ChevronDownIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="m6 9 6 6 6-6" />
    </Icon>
);
const LedgerIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
        <path d="M14.5 3.5V7h4M9 11h6M9 14.5h6M9 18h3.5" />
    </Icon>
);

// Who did it. "System" when no person was signed in, for example a scheduled job.
function Actor({ row, compact = false }: { row: AuditRow; compact?: boolean }) {
    if (!row.actor) {
        return (
            <span className="flex min-w-0 items-center gap-3">
                {!compact && (
                    <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-stone-300 text-xs font-semibold text-stone-500"
                    >
                        SY
                    </span>
                )}
                <span className="truncate font-medium text-stone-600">System</span>
            </span>
        );
    }
    return (
        <span className="flex min-w-0 items-center gap-3">
            {!compact && (
                <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-xs font-semibold text-maroon-800"
                >
                    {initials(row.actor.name)}
                </span>
            )}
            <span className="min-w-0">
                <span className="block truncate font-medium text-stone-900">{row.actor.name}</span>
                {!compact && (
                    <span className="block truncate text-sm text-stone-500">{row.actor.email}</span>
                )}
            </span>
        </span>
    );
}

// The full record for one row: who, what, when and the saved details.
function Details({ row }: { row: AuditRow }) {
    const meta = row.meta ? Object.entries(row.meta) : [];
    const facts: [string, ReactNode][] = [
        ['When', fullStamp.format(new Date(row.created_at))],
        ['Actor', row.actor ? `${row.actor.name} (${row.actor.email})` : 'System'],
        ['Action', <span className="font-mono">{row.action}</span>],
        ['Entity', entityOf(row)],
        ['IP address', <span className="font-mono">{row.ip_address ?? 'None'}</span>],
    ];
    return (
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
            <div>
                <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                    Entry
                </h3>
                <dl className="mt-2 divide-y divide-stone-200 border-y border-stone-200 text-sm">
                    {facts.map(([name, value]) => (
                        <div
                            key={name}
                            className="grid gap-0.5 py-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3"
                        >
                            <dt className="text-stone-500">{name}</dt>
                            <dd className="break-words text-stone-800">{value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
            <div>
                <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                    Details saved
                </h3>
                {meta.length === 0 ? (
                    <p className="mt-2 border-y border-stone-200 py-2 text-sm text-stone-500">
                        No extra details for this entry.
                    </p>
                ) : (
                    <dl className="mt-2 divide-y divide-stone-200 border-y border-stone-200 text-sm">
                        {meta.map(([key, value]) => (
                            <div
                                key={key}
                                className="grid gap-0.5 py-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3"
                            >
                                <dt className="break-words text-stone-500">{keyLabel(key)}</dt>
                                <dd
                                    className={`break-words text-stone-800 ${value !== null && typeof value === 'object' ? 'font-mono text-xs leading-5' : ''}`}
                                >
                                    {valueText(value)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </div>
    );
}

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3, 4, 5].map((row) => (
                <tr key={row} aria-hidden="true">
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-20 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                            <div className="size-8 animate-pulse rounded-full bg-stone-200" />
                            <div>
                                <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
                                <div className="mt-2 h-3 w-44 animate-pulse rounded bg-stone-200" />
                            </div>
                        </div>
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-36 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="py-3.5 lg:px-5">
                        <div className="hidden h-4 w-24 animate-pulse rounded bg-stone-200 lg:block" />
                    </td>
                    <td />
                </tr>
            ))}
        </>
    );
}

function SkeletonItems() {
    return (
        <>
            {[0, 1, 2, 3, 4].map((row) => (
                <li key={row} aria-hidden="true" className="px-4 py-3.5">
                    <div className="h-4 w-44 animate-pulse rounded bg-stone-200" />
                    <div className="mt-2 h-3 w-56 animate-pulse rounded bg-stone-200" />
                </li>
            ))}
        </>
    );
}

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
    // The open row, tied to the current filters and page, so a new view starts closed.
    const [open, setOpen] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [actor, setActor] = useState(filters.actor);
    const [action, setAction] = useState(filters.action);
    const list = useQuery({
        queryKey: ['audit-logs', filters],
        queryFn: () => listAuditLogs(filters),
        placeholderData: keepPreviousData,
    });

    const set = (key: keyof AuditFilters, value: string) => {
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                if (value) next.set(key, value);
                else next.delete(key);
                if (key !== 'page') next.delete('page');
                return next;
            },
            { replace: true },
        );
    };

    // The text filters wait for a short pause in typing so every key press is not a request.
    useEffect(() => {
        if (actor.trim() === filters.actor && action.trim() === filters.action) return;
        const timer = window.setTimeout(() => {
            setParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    for (const [key, value] of [
                        ['actor', actor.trim()],
                        ['action', action.trim()],
                    ] as const) {
                        if (value) next.set(key, value);
                        else next.delete(key);
                    }
                    next.delete('page');
                    return next;
                },
                { replace: true },
            );
        }, 300);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actor, action]);

    const pageKey = params.toString();
    const rowKey = (id: number) => `${pageKey}#${id}`;

    const clear = () => {
        setActor('');
        setAction('');
        setParams({}, { replace: true });
    };
    const toggle = (id: number) =>
        setOpen((current) => (current === rowKey(id) ? null : rowKey(id)));

    const activeMore = MORE_FILTERS.filter((key) => filters[key] !== '').length;
    const activeAll = activeMore + (filters.actor ? 1 : 0);
    const filtered = activeAll > 0;
    const rows = list.data?.data ?? [];
    const meta = list.data?.meta;
    const nothingYet = list.isSuccess && !filtered && (meta?.total ?? 0) === 0;
    const first = meta ? (meta.current_page - 1) * PER_PAGE + 1 : 0;
    const last = meta ? Math.min(meta.total, first + rows.length - 1) : 0;
    const groups = byDay(rows);

    return (
        <div className="mx-auto max-w-[1440px]">
            <header>
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    Records
                </h1>
                <p className="mt-1 max-w-xl text-pretty text-stone-600">
                    The audit log. Who did what and when. Entries cannot be changed or deleted.
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
            ) : nothingYet ? (
                <div className="mt-8 flex flex-col items-center rounded-card bg-white px-6 py-16 text-center ring-1 ring-stone-200">
                    <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <LedgerIcon className="size-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-stone-900">No entries yet</h2>
                    <p className="mt-1 max-w-sm text-pretty text-stone-600">
                        Sign ins, role changes and other sensitive actions show up here as they
                        happen.
                    </p>
                </div>
            ) : (
                <section className="mt-8" aria-busy={list.isPending || undefined}>
                    <form
                        role="search"
                        aria-label="Filter the audit log"
                        onSubmit={(e) => e.preventDefault()}
                        className="space-y-3 md:grid md:grid-cols-4 md:items-end md:gap-3 md:space-y-0 xl:grid-cols-[minmax(12rem,1fr)_minmax(13rem,1fr)_minmax(0,11rem)_minmax(0,10rem)_minmax(0,10rem)]"
                    >
                        <div className="flex items-end gap-2 md:col-span-4 xl:col-span-1">
                            <label className={`${label} flex-1`}>
                                <span className="mb-1.5 block">Actor</span>
                                <span className="relative block">
                                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
                                    <input
                                        type="search"
                                        className={`${control} pl-10 md:pl-9`}
                                        placeholder="Name or email"
                                        value={actor}
                                        onChange={(e) => setActor(e.target.value)}
                                    />
                                </span>
                            </label>
                            <button
                                type="button"
                                aria-expanded={showFilters}
                                aria-controls="audit-filters"
                                onClick={() => setShowFilters((shown) => !shown)}
                                className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-control border px-4 text-base font-semibold transition-colors md:hidden ${showFilters || activeMore > 0 ? 'border-maroon-700 bg-maroon-50 text-maroon-800' : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50'}`}
                            >
                                <FilterIcon className="size-5" />
                                Filters
                                {activeMore > 0 && (
                                    <span className="text-sm tabular-nums">
                                        <span className="sr-only">, </span>
                                        {activeMore}
                                        <span className="sr-only"> on</span>
                                    </span>
                                )}
                            </button>
                        </div>
                        <div
                            id="audit-filters"
                            className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 gap-3 md:contents`}
                        >
                            <label className={`${label} col-span-2 md:col-span-1`}>
                                <span className="mb-1.5 block">Action</span>
                                <input
                                    type="search"
                                    className={`${control} font-mono`}
                                    placeholder="Starts with, e.g. role."
                                    value={action}
                                    onChange={(e) => setAction(e.target.value)}
                                />
                            </label>
                            <label className={`${label} col-span-2 md:col-span-1`}>
                                <span className="mb-1.5 block">Entity</span>
                                <span className="relative block">
                                    <select
                                        className={`${control} cursor-pointer appearance-none pr-10`}
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
                        </div>
                    </form>

                    <div className="mt-6 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        <div className="relative flex min-h-14 items-center justify-between gap-3 border-b border-stone-200 px-4 md:min-h-12 md:px-5">
                            <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
                                {list.isPending
                                    ? 'Loading entries...'
                                    : meta && meta.total > 0
                                      ? `Showing ${first} to ${last} of ${meta.total}`
                                      : '0 entries'}
                            </p>
                            {/* Always in the layout so a filter never moves anything. */}
                            <button
                                type="button"
                                onClick={clear}
                                disabled={!filtered}
                                tabIndex={filtered ? 0 : -1}
                                aria-hidden={!filtered || undefined}
                                className={`inline-flex min-h-12 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline md:min-h-8 ${filtered ? '' : 'invisible'}`}
                            >
                                Clear filters{activeAll > 0 ? ` (${activeAll})` : ''}
                            </button>
                            <div
                                aria-hidden="true"
                                className={`absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-maroon-700/10 transition-opacity ${list.isFetching && !list.isPending ? 'opacity-100' : 'opacity-0'}`}
                            >
                                <div className="h-full w-1/3 animate-pulse bg-maroon-700/60" />
                            </div>
                        </div>

                        {list.isSuccess && rows.length === 0 && (
                            <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
                                <p className="text-stone-700">No entries match these filters.</p>
                                <button
                                    type="button"
                                    onClick={clear}
                                    className="mt-2 inline-flex min-h-12 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline md:min-h-0"
                                >
                                    Clear filters
                                </button>
                            </div>
                        )}

                        {/* Phones and small tablets: one tappable entry per row, grouped by day. */}
                        {(list.isPending || rows.length > 0) && (
                            <div className="md:hidden">
                                {list.isPending && (
                                    <ul className="divide-y divide-stone-100">
                                        <SkeletonItems />
                                    </ul>
                                )}
                                {groups.map((group) => (
                                    <section key={group.day} aria-label={group.day}>
                                        <h2 className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                                            {group.day}
                                        </h2>
                                        <ul className="divide-y divide-stone-100">
                                            {group.rows.map((row) => {
                                                const expanded = open === rowKey(row.id);
                                                return (
                                                    <li
                                                        key={row.id}
                                                        className={expanded ? 'bg-stone-50' : ''}
                                                    >
                                                        <button
                                                            type="button"
                                                            aria-expanded={expanded}
                                                            aria-controls={`audit-m-${row.id}`}
                                                            onClick={() => toggle(row.id)}
                                                            className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50 active:bg-stone-100"
                                                        >
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate font-mono text-sm font-medium text-stone-900">
                                                                    {row.action}
                                                                </span>
                                                                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-stone-600">
                                                                    <span className="min-w-0 truncate">
                                                                        {row.actor?.name ??
                                                                            'System'}
                                                                    </span>
                                                                    <span
                                                                        aria-hidden="true"
                                                                        className="text-stone-400"
                                                                    >
                                                                        ·
                                                                    </span>
                                                                    <span className="shrink-0">
                                                                        {entityOf(row)}
                                                                    </span>
                                                                </span>
                                                                <span className="mt-0.5 block text-sm text-stone-500 tabular-nums">
                                                                    {timeOf.format(
                                                                        new Date(row.created_at),
                                                                    )}
                                                                </span>
                                                            </span>
                                                            <ChevronDownIcon
                                                                className={`size-5 shrink-0 text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                                            />
                                                        </button>
                                                        {expanded && (
                                                            <div
                                                                id={`audit-m-${row.id}`}
                                                                className="px-4 pt-1 pb-5"
                                                            >
                                                                <Details row={row} />
                                                            </div>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        )}

                        {/* From 768 px: a table. A click anywhere on a row opens its details. */}
                        {(list.isPending || rows.length > 0) && (
                            <div className="hidden md:block">
                                <table className="w-full table-fixed text-left">
                                    <thead className="border-b border-stone-200">
                                        <tr>
                                            <th scope="col" className={`${headCell} w-32`}>
                                                Time
                                            </th>
                                            <th
                                                scope="col"
                                                className={`${headCell} w-[36%] lg:w-[32%]`}
                                            >
                                                Actor
                                            </th>
                                            <th scope="col" className={headCell}>
                                                Action
                                            </th>
                                            <th
                                                scope="col"
                                                className="w-0 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-stone-500 uppercase lg:w-[20%] lg:px-5"
                                            >
                                                {/* Under 1024 px the entity shows under the action instead. */}
                                                <span className="hidden lg:inline">Entity</span>
                                            </th>
                                            <th scope="col" className="w-14">
                                                <span className="sr-only">Details</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    {list.isPending && (
                                        <tbody className="divide-y divide-stone-100">
                                            <SkeletonRows />
                                        </tbody>
                                    )}
                                    {groups.map((group) => (
                                        <tbody
                                            key={group.day}
                                            className="divide-y divide-stone-100 border-b border-stone-100 last:border-b-0"
                                        >
                                            <tr className="bg-stone-50">
                                                <th
                                                    scope="colgroup"
                                                    colSpan={5}
                                                    className="px-5 py-2 text-xs font-semibold tracking-wide text-stone-500 uppercase"
                                                >
                                                    {group.day}
                                                </th>
                                            </tr>
                                            {group.rows.map((row) => {
                                                const expanded = open === rowKey(row.id);
                                                return (
                                                    <Fragment key={row.id}>
                                                        <tr
                                                            onClick={() => {
                                                                // Selecting text to copy it should not toggle the row.
                                                                if (
                                                                    window
                                                                        .getSelection()
                                                                        ?.toString()
                                                                ) {
                                                                    return;
                                                                }
                                                                toggle(row.id);
                                                            }}
                                                            className={`group cursor-pointer transition-colors hover:bg-stone-50 ${expanded ? 'bg-maroon-50/60 hover:bg-maroon-50/60' : ''}`}
                                                        >
                                                            <td className="px-5 py-3 text-sm whitespace-nowrap text-stone-700 tabular-nums">
                                                                {timeOf.format(
                                                                    new Date(row.created_at),
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3">
                                                                <Actor row={row} />
                                                            </td>
                                                            <td className="px-5 py-3 text-sm">
                                                                <p
                                                                    className="truncate font-mono text-stone-900"
                                                                    title={row.action}
                                                                >
                                                                    {row.action}
                                                                </p>
                                                                <p className="mt-0.5 truncate text-stone-500 lg:hidden">
                                                                    {entityOf(row)}
                                                                </p>
                                                            </td>
                                                            <td className="w-0 py-3 text-sm text-stone-700 lg:px-5">
                                                                <span
                                                                    className="hidden truncate lg:block"
                                                                    title={entityOf(row)}
                                                                >
                                                                    {entityOf(row)}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 pr-3 text-right">
                                                                <button
                                                                    type="button"
                                                                    aria-expanded={expanded}
                                                                    aria-controls={`audit-d-${row.id}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggle(row.id);
                                                                    }}
                                                                    className="inline-flex size-9 items-center justify-center rounded-control text-stone-400 transition-colors group-hover:text-maroon-700 hover:bg-stone-100"
                                                                >
                                                                    <ChevronDownIcon
                                                                        className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                                                    />
                                                                    <span className="sr-only">
                                                                        {expanded
                                                                            ? 'Hide details'
                                                                            : 'Show details'}{' '}
                                                                        for {row.action}
                                                                    </span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {expanded && (
                                                            <tr
                                                                id={`audit-d-${row.id}`}
                                                                className="bg-maroon-50/60"
                                                            >
                                                                <td
                                                                    colSpan={5}
                                                                    className="px-5 pt-1 pb-5"
                                                                >
                                                                    <div className="rounded-card bg-white p-5 ring-1 ring-stone-200">
                                                                        <Details row={row} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    ))}
                                </table>
                            </div>
                        )}

                        {meta && meta.last_page > 1 && (
                            <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 md:px-5">
                                <Button
                                    variant="secondary"
                                    size="md"
                                    className="max-md:min-h-12"
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
                                    className="max-md:min-h-12"
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

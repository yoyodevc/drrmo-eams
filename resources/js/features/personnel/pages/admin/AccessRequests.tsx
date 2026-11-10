// A-Access requests (SCREENS.md). Admin approves or rejects volunteer sign up requests.
// Desktop first at 1280 px with a table, like People and Notifications. Under 768 px the rows
// become a list and the status tabs become a select. The status sits in the URL (?status=), so a
// view can be shared. Approve and Reject both ask first, in the shared ConfirmDialog.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Avatar, ChevronDownIcon, SearchIcon, chipBase } from '@/features/personnel/components/ui';
import {
    approveRequest,
    listRequests,
    rejectRequest,
    type AccessRequest,
    type RequestFilter,
    type RequestStatus,
} from '@/features/personnel/registration';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

const REASON_MIN = 3;
const REASON_MAX = 500;

const headCell = 'px-4 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase';
// 48 px and 16 px text on phones so iOS does not zoom; the denser 40 px admin size from 768 px.
const control =
    'block min-h-12 w-full rounded-control border border-stone-300 bg-white px-3 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:text-sm';

const filters: { value: RequestFilter; label: string }[] = [
    { value: 'pending_approval', label: 'To review' },
    { value: 'pending_email', label: 'Email not confirmed' },
    { value: 'active', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
];

const statuses: Record<RequestStatus, { label: string; chip: string }> = {
    pending_approval: {
        label: 'Waiting for review',
        chip: 'bg-amber-50 text-amber-900 ring-amber-200',
    },
    pending_email: {
        label: 'Email not confirmed',
        chip: 'bg-stone-100 text-stone-600 ring-stone-200',
    },
    active: { label: 'Approved', chip: 'bg-green-50 text-green-800 ring-green-200' },
    rejected: { label: 'Rejected', chip: 'bg-red-50 text-red-800 ring-red-200' },
};

const emptyText: Record<RequestFilter, { title: string; text: string }> = {
    pending_approval: {
        title: 'Nothing to review',
        text: 'New requests show here once the volunteer confirms their email.',
    },
    pending_email: {
        title: 'No unconfirmed sign ups',
        text: 'People who asked for access but did not enter their email code show here.',
    },
    active: { title: 'No approved requests yet', text: 'Requests you approve show here.' },
    rejected: { title: 'No rejected requests', text: 'Requests you reject show here.' },
    all: {
        title: 'No access requests yet',
        text: 'Volunteers ask for an account from the Request access link on the sign in screen.',
    },
};

// "Nov 10, 1:12 PM". The year only shows when it is not this year, to keep rows short.
const thisYear = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});
const otherYear = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function stamp(iso: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    return (date.getFullYear() === new Date().getFullYear() ? thisYear : otherYear).format(date);
}

function isFilter(value: string | null): value is RequestFilter {
    return filters.some((f) => f.value === value);
}

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

const CheckIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
);

const CrossIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Icon>
);

const InboxIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="M3.5 13.5 6 5h12l2.5 8.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-4.5Z" />
        <path d="M3.5 13.5H8.5l1 2.5h5l1-2.5h5" />
    </Icon>
);

function StatusChip({ status }: { status: RequestStatus }) {
    return (
        <span className={`${chipBase} whitespace-nowrap ${statuses[status].chip}`}>
            {statuses[status].label}
        </span>
    );
}

// What happened after the request: when it was approved or rejected, and the reason.
function Outcome({ row }: { row: AccessRequest }) {
    const reviewed = stamp(row.reviewed_at);
    return (
        <>
            {row.account_status === 'active' && reviewed && (
                <p className="mt-1 text-xs text-stone-500 tabular-nums">Approved {reviewed}</p>
            )}
            {row.account_status === 'rejected' && (
                <>
                    {reviewed && (
                        <p className="mt-1 text-xs text-stone-500 tabular-nums">
                            Rejected {reviewed}
                        </p>
                    )}
                    {row.rejection_reason && (
                        <p
                            className="mt-1 line-clamp-2 max-w-xs text-sm text-pretty text-stone-700"
                            title={row.rejection_reason}
                        >
                            <span className="text-stone-500">Reason: </span>
                            {row.rejection_reason}
                        </p>
                    )}
                </>
            )}
        </>
    );
}

function RowActions({
    row,
    onApprove,
    onReject,
    phone = false,
}: {
    row: AccessRequest;
    onApprove: (row: AccessRequest) => void;
    onReject: (row: AccessRequest) => void;
    phone?: boolean;
}) {
    if (row.account_status !== 'pending_approval') return null;
    return (
        <div className={phone ? 'mt-3 grid grid-cols-2 gap-2' : 'flex gap-2'}>
            <Button
                variant="secondary"
                size={phone ? 'lg' : 'md'}
                onClick={() => onApprove(row)}
                aria-label={`Approve ${row.name}`}
            >
                <CheckIcon className="size-4 text-green-700" />
                Approve
            </Button>
            <Button
                variant="secondary"
                size={phone ? 'lg' : 'md'}
                onClick={() => onReject(row)}
                aria-label={`Reject ${row.name}`}
            >
                <CrossIcon className="size-4 text-red-700" />
                Reject
            </Button>
        </div>
    );
}

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3].map((row) => (
                <tr key={row} aria-hidden="true">
                    <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                            <div className="size-10 animate-pulse rounded-full bg-stone-200" />
                            <div>
                                <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
                                <div className="mt-2 h-3 w-44 animate-pulse rounded bg-stone-200" />
                            </div>
                        </div>
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-28 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-5 w-28 animate-pulse rounded-full bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5" />
                </tr>
            ))}
        </>
    );
}

function problem(error: unknown): string {
    if (error instanceof ApiError && error.status === 409) {
        return 'Someone already handled this request. The list is up to date now.';
    }
    return 'That did not go through. Check your connection and try again.';
}

export function AccessRequests() {
    const client = useQueryClient();
    const reasonId = useId();
    const [params, setParams] = useSearchParams();
    const asked = params.get('status');
    const filter: RequestFilter = isFilter(asked) ? asked : 'pending_approval';
    const [term, setTerm] = useState('');
    const [target, setTarget] = useState<AccessRequest | null>(null);
    const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
    const [reason, setReason] = useState('');
    const [done, setDone] = useState<string | null>(null);

    const list = useQuery({
        queryKey: ['access-requests', filter],
        queryFn: () => listRequests(filter),
        placeholderData: keepPreviousData,
    });

    const refresh = () => client.invalidateQueries({ queryKey: ['access-requests'] });

    const approve = useMutation({
        mutationFn: (row: AccessRequest) => approveRequest(row.id),
        onSuccess: (_, row) => {
            setDialog(null);
            setDone(`${row.name} is approved and can sign in now. We emailed them.`);
            return refresh();
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 409) void refresh();
        },
    });
    const reject = useMutation({
        mutationFn: ({ row, text }: { row: AccessRequest; text: string }) =>
            rejectRequest(row.id, text),
        onSuccess: (_, { row }) => {
            setDialog(null);
            setDone(`${row.name}'s request is rejected. We emailed them the reason.`);
            return refresh();
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 409) void refresh();
        },
    });

    function show(next: RequestFilter) {
        setDone(null);
        const query = new URLSearchParams(params);
        if (next === 'pending_approval') query.delete('status');
        else query.set('status', next);
        setParams(query, { replace: true });
    }

    function openApprove(row: AccessRequest) {
        approve.reset();
        setDone(null);
        setTarget(row);
        setDialog('approve');
    }

    function openReject(row: AccessRequest) {
        reject.reset();
        setDone(null);
        setTarget(row);
        setReason('');
        setDialog('reject');
    }

    const counts = list.data?.counts;
    const needle = term.trim().toLowerCase();
    const all = list.data?.data ?? [];
    const rows = needle
        ? all.filter(
              (r) =>
                  r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle),
          )
        : all;
    const searching = needle !== '';
    const empty = list.isSuccess && rows.length === 0;
    const reasonOk = reason.trim().length >= REASON_MIN;
    const current = filters.find((f) => f.value === filter)?.label ?? '';

    const emptyState = searching ? (
        <div className="px-5 py-12 text-center">
            <p className="text-stone-700">No requests match “{term.trim()}”.</p>
            <button
                type="button"
                onClick={() => setTerm('')}
                className="mt-2 rounded-sm text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline"
            >
                Clear search
            </button>
        </div>
    ) : (
        <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                <InboxIcon className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-stone-900">{emptyText[filter].title}</h2>
            <p className="mt-1 max-w-sm text-pretty text-stone-600">{emptyText[filter].text}</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-[1440px]">
            <header>
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    Access requests
                </h1>
                <p className="mt-1 max-w-xl text-pretty text-stone-600">
                    Volunteers who asked for an account from the sign in screen. Approve the ones
                    you know so they can sign in.
                </p>
            </header>

            {list.isError ? (
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">
                        The requests did not load. Check your connection and try again.
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
                        role="search"
                        aria-label="Filter access requests"
                        onSubmit={(e) => e.preventDefault()}
                        className="flex flex-wrap items-end gap-3"
                    >
                        {/* Phones: a select, so every status fits without sideways scrolling. */}
                        <label className="block w-full text-sm font-medium text-stone-800 md:hidden">
                            <span className="mb-1.5 block">Show</span>
                            <span className="relative block">
                                <select
                                    className={`${control} cursor-pointer appearance-none pr-10`}
                                    value={filter}
                                    onChange={(e) => show(e.target.value as RequestFilter)}
                                >
                                    {filters.map((f) => (
                                        <option key={f.value} value={f.value}>
                                            {f.label}
                                            {counts ? ` (${counts[f.value]})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-stone-500" />
                            </span>
                        </label>

                        {/* From 768 px: tabs. Every tab keeps the same weight and a fixed count
                            width, so picking one never moves the others. */}
                        <div className="hidden md:block">
                            <span
                                className="mb-1.5 block text-sm font-medium text-stone-800"
                                id="request-status"
                            >
                                Status
                            </span>
                            <div
                                className="inline-flex rounded-control bg-stone-100 p-1"
                                role="group"
                                aria-labelledby="request-status"
                            >
                                {filters.map((f) => {
                                    const selected = filter === f.value;
                                    return (
                                        <button
                                            key={f.value}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => show(f.value)}
                                            className={`inline-flex min-h-8 items-center gap-2 rounded-[6px] px-3 text-sm font-semibold transition-colors ${selected ? 'bg-white text-stone-900 ring-1 ring-stone-200' : 'text-stone-600 hover:text-stone-900'}`}
                                        >
                                            {f.label}
                                            <span
                                                className={`min-w-[1.25rem] text-center text-xs tabular-nums ${selected ? 'text-stone-600' : 'text-stone-500'}`}
                                            >
                                                {counts && (
                                                    <>
                                                        <span className="sr-only">, </span>
                                                        {counts[f.value]}
                                                    </>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <label className="block w-full text-sm font-medium text-stone-800 md:ml-auto md:w-72">
                            <span className="mb-1.5 block">Search</span>
                            <span className="relative block">
                                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
                                <input
                                    type="search"
                                    className={`${control} pl-10 md:pl-9`}
                                    placeholder="Name or email"
                                    value={term}
                                    onChange={(e) => setTerm(e.target.value)}
                                />
                            </span>
                        </label>
                    </form>

                    {done && (
                        <div className="mt-5 max-w-2xl">
                            <Alert tone="success">{done}</Alert>
                        </div>
                    )}

                    <div className="mt-6 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-stone-200 px-4 md:px-5">
                            <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
                                {list.isPending
                                    ? 'Loading requests...'
                                    : `${rows.length} ${rows.length === 1 ? 'request' : 'requests'}${searching ? ' found' : ''} · ${current}`}
                            </p>
                            {list.isFetching && !list.isPending && (
                                <p className="text-sm text-stone-500">Updating...</p>
                            )}
                        </div>

                        {/* Phones: one row per person, actions full width under it. */}
                        <div className="md:hidden">
                            {list.isPending && (
                                <ul aria-hidden="true" className="divide-y divide-stone-100">
                                    {[0, 1, 2].map((n) => (
                                        <li key={n} className="flex gap-3 px-4 py-4">
                                            <div className="size-10 animate-pulse rounded-full bg-stone-200" />
                                            <div className="flex-1">
                                                <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
                                                <div className="mt-2 h-3 w-48 animate-pulse rounded bg-stone-200" />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {empty && emptyState}
                            {rows.length > 0 && (
                                <ul className="divide-y divide-stone-100">
                                    {rows.map((row) => (
                                        <li key={row.id} className="px-4 py-4">
                                            <div className="flex gap-3">
                                                <Avatar
                                                    first={row.first_name}
                                                    last={row.last_name}
                                                    dim={row.account_status === 'rejected'}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-stone-900">
                                                        {row.name}
                                                    </p>
                                                    <p className="truncate text-sm text-stone-500">
                                                        {row.email}
                                                    </p>
                                                    <div className="mt-2">
                                                        <StatusChip status={row.account_status} />
                                                    </div>
                                                    <p className="mt-2 text-xs text-stone-500 tabular-nums">
                                                        Requested{' '}
                                                        {stamp(row.requested_at) ?? 'earlier'}
                                                    </p>
                                                    <Outcome row={row} />
                                                </div>
                                            </div>
                                            <RowActions
                                                row={row}
                                                onApprove={openApprove}
                                                onReject={openReject}
                                                phone
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* From 768 px: the table. */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-[760px] text-left">
                                <thead className="border-b border-stone-200">
                                    <tr>
                                        <th scope="col" className={headCell}>
                                            Person
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Requested
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Status
                                        </th>
                                        <th scope="col" className={headCell}>
                                            Decision
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {list.isPending && <SkeletonRows />}
                                    {empty && (
                                        <tr>
                                            <td colSpan={4}>{emptyState}</td>
                                        </tr>
                                    )}
                                    {rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="align-top transition-colors hover:bg-stone-50"
                                        >
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        first={row.first_name}
                                                        last={row.last_name}
                                                        dim={row.account_status === 'rejected'}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-stone-900">
                                                            {row.name}
                                                        </p>
                                                        <p className="text-sm text-stone-500">
                                                            {row.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">
                                                <p className="text-sm leading-6 text-stone-700">
                                                    {stamp(row.requested_at) ?? '-'}
                                                </p>
                                                <p className="text-sm text-stone-500">
                                                    {row.email_verified_at
                                                        ? `Confirmed ${stamp(row.email_verified_at)}`
                                                        : 'Email not confirmed'}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3.5 pt-4">
                                                <StatusChip status={row.account_status} />
                                            </td>
                                            {/* Buttons while it waits, then what was decided. */}
                                            <td className="px-4 py-3">
                                                {row.account_status === 'pending_approval' ? (
                                                    <RowActions
                                                        row={row}
                                                        onApprove={openApprove}
                                                        onReject={openReject}
                                                    />
                                                ) : (
                                                    <div className="pt-1 [&>p:first-child]:mt-0">
                                                        <Outcome row={row} />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            <ConfirmDialog
                open={dialog === 'approve'}
                title={`Approve ${target?.name ?? ''}?`}
                description={`${target?.first_name ?? 'They'} can sign in as a volunteer right away. We email ${target?.email ?? 'them'} to say so.`}
                confirmLabel="Approve"
                loading={approve.isPending}
                loadingLabel="Approving..."
                error={approve.isError ? problem(approve.error) : null}
                onConfirm={() => target && approve.mutate(target)}
                onCancel={() => setDialog(null)}
            />

            <ConfirmDialog
                open={dialog === 'reject'}
                tone="danger"
                title={`Reject ${target?.name ?? ''}?`}
                description="They will not be able to sign in. We email them the reason below, and it is kept in the audit log."
                confirmLabel="Reject request"
                loading={reject.isPending}
                loadingLabel="Rejecting..."
                error={reject.isError ? problem(reject.error) : null}
                confirmDisabled={!reasonOk}
                onConfirm={() =>
                    target && reasonOk && reject.mutate({ row: target, text: reason.trim() })
                }
                onCancel={() => setDialog(null)}
            >
                <label
                    htmlFor={reasonId}
                    className="mb-1.5 block text-sm font-medium text-stone-800"
                >
                    Reason
                </label>
                <textarea
                    id={reasonId}
                    rows={3}
                    maxLength={REASON_MAX}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-describedby={`${reasonId}-hint`}
                    placeholder="For example: We could not find you in the volunteer list."
                    className="block w-full resize-y rounded-control border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900 transition-colors placeholder:text-stone-400 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none"
                />
                <p
                    id={`${reasonId}-hint`}
                    className="mt-1.5 flex justify-between gap-3 text-sm text-stone-500"
                >
                    <span>At least {REASON_MIN} characters.</span>
                    <span className="tabular-nums">
                        {reason.length}/{REASON_MAX}
                    </span>
                </p>
            </ConfirmDialog>
        </div>
    );
}

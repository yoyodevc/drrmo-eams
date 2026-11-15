// A-Memo manager (S5.1, SCREENS.md). Desktop first. Table of memos with category and date.
// Posting and editing happen on their own page. Delete asks first, then is soft and audited.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ClipboardIcon, PencilIcon, PlusIcon } from '@/features/events/components/icons';
import { SearchIcon } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { deleteMemo, fileKind, fileSize, listMemos, postedOn, type Memo } from '../../api';

const headCell = 'px-5 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase';

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3].map((row) => (
                <tr key={row} aria-hidden="true">
                    <td className="px-5 py-4">
                        <div className="h-4 w-56 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-5 w-20 animate-pulse rounded-full bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-4">
                        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td />
                </tr>
            ))}
        </>
    );
}

// Row actions: 40 px squares, line icons drawn inline like the rest of the app (DESIGN_SYSTEM.md, Icons).
const iconAction =
    'group relative inline-flex size-10 items-center justify-center rounded-control transition-colors';

function LineIcon({ children }: { children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

const EyeIcon = () => (
    <LineIcon>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
    </LineIcon>
);

const TrashIcon = () => (
    <LineIcon>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </LineIcon>
);

// The word for an icon button, shown above it on hover and keyboard focus (same look as the sidebar tips).
function Tip({ children }: { children: ReactNode }) {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-control bg-stone-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-raised group-hover:block group-focus-visible:block"
        >
            {children}
        </span>
    );
}

// What the memo holds, in words, so the table never relies on an icon alone.
function Contents({ memo }: { memo: Memo }) {
    if (!memo.file) return <span className="text-stone-700">Text only</span>;
    return (
        <span className="block min-w-0">
            <span className="block text-stone-800 tabular-nums">
                {fileKind(memo.file.type)} · {fileSize(memo.file.size)}
                {memo.has_body && <span className="text-stone-600"> + text</span>}
            </span>
            <span className="block truncate text-stone-500" title={memo.file.name}>
                {memo.file.name}
            </span>
        </span>
    );
}

export function MemoManager() {
    const [params, setParams] = useSearchParams();
    const q = params.get('q') ?? '';
    const category = params.get('category') ?? '';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const queryClient = useQueryClient();
    const [removing, setRemoving] = useState<Memo | null>(null);
    // A memo deleted from its own page arrives here with its title, so the list can confirm it.
    const location = useLocation();
    const [deleted, setDeleted] = useState<string | null>(
        (location.state as { deleted?: string } | null)?.deleted ?? null,
    );
    const [term, setTerm] = useState(q);

    const list = useQuery({
        queryKey: ['memos', { q, category, page }],
        queryFn: () => listMemos({ q, category, page }),
        placeholderData: keepPreviousData,
    });
    const remove = useMutation({
        mutationFn: (memo: Memo) => deleteMemo(memo.id),
        onSuccess: async (_, memo) => {
            setRemoving(null);
            setDeleted(memo.title);
            await queryClient.invalidateQueries({ queryKey: ['memos'] });
        },
    });

    const memos = list.data?.data ?? [];
    const lastPage = list.data?.meta.last_page ?? 1;
    const total = list.data?.meta.total ?? 0;
    const categories = list.data?.categories ?? [];
    const matches = categories.reduce((sum, c) => sum + c.count, 0);
    const filtered = q !== '' || category !== '';
    // Changing a filter starts again at page 1. Empty values stay out of the URL.
    const setFilter = (next: { q?: string; category?: string; page?: number }) => {
        const merged = { q, category, ...next, page: next.page ?? 1 };
        setParams(
            Object.fromEntries(
                Object.entries({
                    ...merged,
                    page: merged.page > 1 ? String(merged.page) : '',
                }).filter(([, v]) => v !== ''),
            ),
            { replace: true },
        );
    };
    const clear = () => {
        setTerm('');
        setParams({}, { replace: true });
    };

    // Search waits for a short pause in typing, and starts at 2 letters (BACKLOG S5.2).
    useEffect(() => {
        const next = term.trim().length >= 2 ? term.trim() : '';
        if (next === q) return;
        const timer = window.setTimeout(() => setFilter({ q: next }), 300);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    return (
        <div className="mx-auto max-w-[1440px]">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Memos
                    </h1>
                    <p className="mt-1 text-pretty text-stone-600">
                        Policies, procedures and advisories everyone can search on their phone.
                    </p>
                </div>
                <Link
                    to="/admin/memos/new"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-maroon-700 pr-4 pl-3 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 active:bg-maroon-900"
                >
                    <PlusIcon />
                    New memo
                </Link>
            </header>

            {deleted && (
                <div className="mt-6 max-w-3xl">
                    <Alert tone="success">
                        &quot;{deleted}&quot; was deleted. The audit log keeps a record.
                    </Alert>
                </div>
            )}

            {list.isError && !list.data ? (
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">{list.error.message}</Alert>
                    <Button
                        variant="secondary"
                        size="md"
                        loading={list.isFetching}
                        onClick={() => void list.refetch()}
                    >
                        {list.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            ) : list.isSuccess && matches === 0 && !filtered ? (
                <div className="mt-8 flex flex-col items-center rounded-card bg-white px-6 py-16 text-center ring-1 ring-stone-200">
                    <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <ClipboardIcon className="size-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-stone-900">No memos yet</h2>
                    <p className="mt-1 max-w-sm text-pretty text-stone-600">
                        Post the first policy or procedure. Everyone can read it on their phone.
                    </p>
                    <Link
                        to="/admin/memos/new"
                        className="mt-6 inline-flex min-h-10 items-center rounded-control border border-stone-500 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50"
                    >
                        Post the first memo
                    </Link>
                </div>
            ) : (
                <section className="mt-8" aria-busy={list.isPending || undefined}>
                    <form
                        role="search"
                        aria-label="Find memos"
                        onSubmit={(e) => e.preventDefault()}
                        className="mb-4 space-y-3"
                    >
                        <label className="block max-w-md text-sm font-medium text-stone-800">
                            <span className="mb-1.5 block">Search</span>
                            <span className="relative block">
                                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-500" />
                                <input
                                    type="search"
                                    className="block min-h-10 w-full rounded-control border border-stone-500 bg-white pr-3 pl-9 text-sm text-stone-900 transition-colors placeholder:text-stone-500 hover:border-stone-600 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none"
                                    placeholder="Title or words in the memo"
                                    value={term}
                                    onChange={(e) => setTerm(e.target.value)}
                                />
                            </span>
                        </label>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <SegmentedControl
                                label="Category"
                                options={[
                                    {
                                        id: '',
                                        label: 'All',
                                        count: list.isSuccess ? matches : undefined,
                                    },
                                    ...categories.map((c) => ({
                                        id: c.value,
                                        label: c.label,
                                        count: c.count,
                                    })),
                                ]}
                                value={category}
                                onChange={(id) => setFilter({ category: id })}
                            />
                            <p className="text-sm text-stone-600" aria-live="polite">
                                {list.isPending
                                    ? 'Loading memos...'
                                    : `${total} ${total === 1 ? 'memo' : 'memos'}${q ? ` for "${q}"` : ''}`}
                            </p>
                        </div>
                    </form>

                    <div className="overflow-x-auto rounded-card bg-white ring-1 ring-stone-200">
                        <table className="w-full min-w-[820px] text-left">
                            <thead className="border-b border-stone-200">
                                <tr>
                                    <th scope="col" className={headCell}>
                                        Memo
                                    </th>
                                    <th scope="col" className={headCell}>
                                        Category
                                    </th>
                                    <th scope="col" className={headCell}>
                                        Contents
                                    </th>
                                    <th scope="col" className={headCell}>
                                        Posted
                                    </th>
                                    {/* Visible, so people know the buttons in this column are what they can do. */}
                                    <th scope="col" className={`${headCell} text-right`}>
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {list.isPending && <SkeletonRows />}
                                {list.isSuccess && memos.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-10 text-center">
                                            <p className="text-sm text-stone-600">
                                                No memos match{q ? ` "${q}"` : ''}
                                                {category &&
                                                    ` in ${categories.find((c) => c.value === category)?.label ?? 'this category'}`}
                                                .
                                            </p>
                                            <Button
                                                className="mt-4"
                                                variant="secondary"
                                                size="md"
                                                onClick={clear}
                                            >
                                                Clear filters
                                            </Button>
                                        </td>
                                    </tr>
                                )}
                                {memos.map((memo) => (
                                    <tr
                                        key={memo.id}
                                        className="transition-colors hover:bg-stone-50"
                                    >
                                        <td className="max-w-md px-5 py-3.5">
                                            <Link
                                                to={`/admin/memos/${memo.id}`}
                                                className="rounded-sm font-medium text-stone-900 underline-offset-2 transition-colors hover:text-maroon-700 hover:underline"
                                            >
                                                {memo.title}
                                            </Link>
                                            {memo.posted_by && (
                                                <p className="mt-0.5 truncate text-sm text-stone-500">
                                                    By {memo.posted_by}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm whitespace-nowrap text-stone-700">
                                            {memo.category_label}
                                        </td>
                                        <td className="max-w-xs px-5 py-3.5 text-sm">
                                            <Contents memo={memo} />
                                        </td>
                                        <td className="px-5 py-3.5 text-sm whitespace-nowrap text-stone-700 tabular-nums">
                                            {postedOn(memo.posted_at)}
                                        </td>
                                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                            {/* Icon buttons. Each has a tooltip on hover and focus, and a full name for screen readers. */}
                                            <div className="inline-flex gap-2">
                                                <Link
                                                    to={`/admin/memos/${memo.id}`}
                                                    aria-label={`View ${memo.title}`}
                                                    className={`${iconAction} text-stone-700 hover:bg-stone-100 hover:text-stone-900`}
                                                >
                                                    <EyeIcon />
                                                    <Tip>View</Tip>
                                                </Link>
                                                <Link
                                                    to={`/admin/memos/${memo.id}/edit`}
                                                    aria-label={`Edit ${memo.title}`}
                                                    className={`${iconAction} text-maroon-700 hover:bg-maroon-50`}
                                                >
                                                    <PencilIcon className="size-5" />
                                                    <Tip>Edit</Tip>
                                                </Link>
                                                <button
                                                    type="button"
                                                    aria-label={`Delete ${memo.title}`}
                                                    onClick={() => {
                                                        remove.reset();
                                                        setRemoving(memo);
                                                    }}
                                                    className={`${iconAction} text-red-700 hover:bg-red-50`}
                                                >
                                                    <TrashIcon />
                                                    <Tip>Delete</Tip>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {lastPage > 1 && (
                        <nav className="mt-6 flex items-center gap-4" aria-label="Pages">
                            <Button
                                variant="secondary"
                                size="md"
                                disabled={page <= 1}
                                onClick={() => setFilter({ page: page - 1 })}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-stone-600 tabular-nums">
                                Page {page} of {lastPage}
                            </span>
                            <Button
                                variant="secondary"
                                size="md"
                                disabled={page >= lastPage}
                                onClick={() => setFilter({ page: page + 1 })}
                            >
                                Next
                            </Button>
                        </nav>
                    )}
                </section>
            )}

            <ConfirmDialog
                open={removing !== null}
                tone="danger"
                title="Delete this memo?"
                description={`"${removing?.title ?? ''}" disappears for everyone. The record stays in the audit log.`}
                confirmLabel="Delete memo"
                loading={remove.isPending}
                loadingLabel="Deleting..."
                error={remove.isError ? remove.error.message : null}
                onConfirm={() => removing && remove.mutate(removing)}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}

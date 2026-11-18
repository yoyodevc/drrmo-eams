// A-Memo manager (S5.1, SCREENS.md). Desktop first, laid out like A-People: search and category in one row,
// a results bar, then a table where the whole row opens the memo. Under 768 px the rows become a tappable
// list and the category becomes a select. Posting and editing happen on their own page. Delete asks
// first, then is soft and audited.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ClipboardIcon } from '@/features/events/components/icons';
import {
    ChevronDownIcon,
    ChevronIcon,
    EditIcon,
    PlusIcon,
    SearchIcon,
    TrashIcon,
} from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { deleteMemo, fileKind, fileSize, listMemos, postedOn, type Memo } from '../../api';

const headCell =
    'px-5 py-3 whitespace-nowrap text-xs font-semibold tracking-wide text-stone-500 uppercase';
// 48 px and 16 px text on phones so iOS does not zoom; the denser 40 px admin size from 768 px.
const control =
    'block min-h-12 w-full rounded-control border border-stone-300 bg-white px-3 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:text-sm';
const textLink =
    'inline-flex items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline';

// Search starts at 2 letters (BACKLOG S5.2).
const MIN_TERM = 2;

// A memo counts as edited when it changed more than a minute after posting.
const wasEdited = (m: Memo) =>
    m.updated_at !== null && Date.parse(m.updated_at) - Date.parse(m.posted_at) > 60_000;

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3, 4].map((row) => (
                <tr key={row} aria-hidden="true">
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-56 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-28 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-20 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-28 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-36 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="ml-auto h-4 w-24 animate-pulse rounded bg-stone-200" />
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
            {[0, 1, 2, 3].map((row) => (
                <li key={row} aria-hidden="true" className="px-4 py-3.5">
                    <div className="h-4 w-52 animate-pulse rounded bg-stone-200" />
                    <div className="mt-2 h-3 w-40 animate-pulse rounded bg-stone-200" />
                    <div className="mt-2 h-3 w-28 animate-pulse rounded bg-stone-200" />
                </li>
            ))}
        </>
    );
}

// The word for an icon button, shown above it on hover and keyboard focus (same look as the sidebar tips).
function Tip({ children }: { children: ReactNode }) {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 rounded-control bg-stone-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-raised group-hover/tip:block group-focus-visible/tip:block"
        >
            {children}
        </span>
    );
}

const iconAction =
    'group/tip relative inline-flex size-10 items-center justify-center rounded-control transition-colors';

// What the memo holds, in words, so the list never relies on an icon alone.
function contentsLine(memo: Memo): string {
    if (!memo.file) return 'Text only';
    return `${fileKind(memo.file.type)} · ${fileSize(memo.file.size)}${memo.has_body ? ' + text' : ''}`;
}

function NoMatch({
    q,
    categoryLabel,
    onClear,
}: {
    q: string;
    categoryLabel: string | null;
    onClear: () => void;
}) {
    return (
        <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-stone-500">
                <SearchIcon className="size-6" />
            </span>
            <p className="mt-4 font-semibold text-stone-900">
                No memos match{q ? ` "${q}"` : ''}
                {categoryLabel ? ` in ${categoryLabel}` : ''}.
            </p>
            <p className="mt-1 max-w-sm text-sm text-pretty text-stone-600">
                Try other words, check the spelling, or look in all categories.
            </p>
            <button
                type="button"
                onClick={onClear}
                className={`${textLink} mt-3 min-h-12 md:min-h-8`}
            >
                Clear filters
            </button>
        </div>
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
    const categoryLabel = category
        ? (categories.find((c) => c.value === category)?.label ?? 'this category')
        : null;
    const tooShort = term.trim().length > 0 && term.trim().length < MIN_TERM;

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
        const next = term.trim().length >= MIN_TERM ? term.trim() : '';
        if (next === q) return;
        const timer = window.setTimeout(() => setFilter({ q: next }), 300);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    const newMemo = (label: string, primary = true) => (
        <Link
            to="/admin/memos/new"
            className={
                primary
                    ? 'inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-control bg-maroon-700 pr-5 pl-4 text-base font-semibold text-white transition-colors hover:bg-maroon-800 active:bg-maroon-900 sm:w-auto md:min-h-10 md:pr-4 md:pl-3 md:text-sm'
                    : 'inline-flex min-h-12 items-center justify-center rounded-control border border-stone-300 bg-white px-4 text-base font-semibold text-stone-800 transition-colors hover:bg-stone-50 md:min-h-10 md:text-sm'
            }
        >
            {primary && <PlusIcon className="size-5 md:size-4" />}
            {label}
        </Link>
    );

    const summary = list.isPending
        ? 'Loading memos...'
        : `${total} ${total === 1 ? 'memo' : 'memos'}${q ? ` for "${q}"` : ''}${categoryLabel ? ` in ${categoryLabel}` : ''}`;

    return (
        <div className="mx-auto max-w-[1440px]">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
                <div className="min-w-0">
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Memos
                    </h1>
                    <p className="mt-1 max-w-xl text-pretty text-stone-600">
                        Policies, procedures and advisories. Everyone can search and read them on
                        their phone.
                    </p>
                </div>
                <div className="w-full sm:w-auto">{newMemo('New memo')}</div>
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
                    <Alert tone="error">
                        The memos did not load. Check your connection and try again.
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
            ) : list.isSuccess && matches === 0 && !filtered ? (
                <div className="mt-8 flex flex-col items-center rounded-card bg-white px-6 py-16 text-center ring-1 ring-stone-200">
                    <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <ClipboardIcon className="size-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-stone-900">No memos yet</h2>
                    <p className="mt-1 max-w-sm text-pretty text-stone-600">
                        Post the first policy, procedure or advisory. Everyone can read it on their
                        phone.
                    </p>
                    <div className="mt-6">{newMemo('Post the first memo', false)}</div>
                </div>
            ) : (
                <section className="mt-8" aria-busy={list.isPending || undefined}>
                    <form
                        role="search"
                        aria-label="Find memos"
                        onSubmit={(e) => e.preventDefault()}
                        className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-x-4"
                    >
                        <label className="block min-w-0 text-sm font-medium text-stone-800 md:w-80 lg:w-96">
                            <span className="mb-1.5 block">Search</span>
                            <span className="relative block">
                                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
                                <input
                                    type="search"
                                    className={`${control} pl-10 md:pl-9`}
                                    placeholder="Title or words in the memo"
                                    value={term}
                                    aria-describedby="memo-search-hint"
                                    onChange={(e) => setTerm(e.target.value)}
                                />
                            </span>
                        </label>

                        {/* Phones: a select, so six categories never wrap into a block of buttons. */}
                        <label className="block text-sm font-medium text-stone-800 md:hidden">
                            <span className="mb-1.5 block">Category</span>
                            <span className="relative block">
                                <select
                                    className={`${control} cursor-pointer appearance-none pr-10`}
                                    value={category}
                                    onChange={(e) => setFilter({ category: e.target.value })}
                                >
                                    <option value="">
                                        All categories{list.isSuccess ? ` (${matches})` : ''}
                                    </option>
                                    {categories.map((c) => (
                                        <option key={c.value} value={c.value}>
                                            {c.label} ({c.count})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-stone-500" />
                            </span>
                        </label>

                        {/* 768 px and up: every category in view, with how many memos match each. */}
                        <div className="hidden md:block">
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
                        </div>
                    </form>
                    <p
                        id="memo-search-hint"
                        className={`mt-1.5 text-sm text-stone-500 ${tooShort ? '' : 'sr-only'}`}
                    >
                        Type at least {MIN_TERM} letters to search.
                    </p>

                    <div className="mt-5 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        <div className="relative flex min-h-14 items-center justify-between gap-3 border-b border-stone-200 px-4 md:min-h-12 md:px-5">
                            <p
                                className="min-w-0 truncate text-sm text-stone-600 tabular-nums"
                                aria-live="polite"
                            >
                                {summary}
                            </p>
                            {/* Always in the layout so a filter never moves anything. */}
                            <button
                                type="button"
                                onClick={clear}
                                disabled={!filtered}
                                tabIndex={filtered ? 0 : -1}
                                aria-hidden={!filtered || undefined}
                                className={`${textLink} min-h-12 shrink-0 md:min-h-8 ${filtered ? '' : 'invisible'}`}
                            >
                                Clear filters
                            </button>
                            {/* A thin line while a new search or page loads over the old rows. */}
                            <div
                                aria-hidden="true"
                                className={`absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-maroon-700/10 transition-opacity ${list.isFetching && !list.isPending ? 'opacity-100' : 'opacity-0'}`}
                            >
                                <div className="h-full w-1/3 animate-pulse bg-maroon-700/60" />
                            </div>
                        </div>

                        {list.isSuccess && memos.length === 0 && (
                            <NoMatch q={q} categoryLabel={categoryLabel} onClear={clear} />
                        )}

                        {/* Phones and small tablets: one tappable row per memo. Edit and Delete are on the memo page. */}
                        {(list.isPending || memos.length > 0) && (
                            <ul className="divide-y divide-stone-100 md:hidden">
                                {list.isPending && <SkeletonItems />}
                                {memos.map((memo) => (
                                    <li key={memo.id}>
                                        <Link
                                            to={`/admin/memos/${memo.id}`}
                                            className="flex min-h-16 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-stone-50 active:bg-stone-100"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="line-clamp-2 font-semibold text-pretty text-stone-900">
                                                    {memo.title}
                                                </span>
                                                <span className="mt-0.5 block truncate text-sm text-stone-600">
                                                    {memo.category_label} ·{' '}
                                                    {postedOn(memo.posted_at)}
                                                </span>
                                                <span className="block truncate text-sm text-stone-500 tabular-nums">
                                                    {contentsLine(memo)}
                                                </span>
                                            </span>
                                            <ChevronIcon className="size-5 shrink-0 text-stone-400" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* 768 px and up: the full table. */}
                        {(list.isPending || memos.length > 0) && (
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[720px] table-fixed text-left">
                                    <colgroup>
                                        <col />
                                        <col className="w-36" />
                                        <col className="w-[24%]" />
                                        <col className="w-36" />
                                        <col className="w-40" />
                                    </colgroup>
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
                                            <th scope="col" className={`${headCell} text-right`}>
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
                                        {memos.map((memo) => (
                                            // The title link stretches over the whole row, so a click anywhere opens the memo.
                                            <tr
                                                key={memo.id}
                                                className="group relative cursor-pointer transition-colors focus-within:bg-stone-50 hover:bg-stone-50"
                                            >
                                                <td className="px-5 py-3.5">
                                                    <Link
                                                        to={`/admin/memos/${memo.id}`}
                                                        className="line-clamp-2 font-medium text-pretty text-stone-900 underline-offset-2 transition-colors group-hover:text-maroon-700 group-hover:underline after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-maroon-600 focus-visible:after:ring-inset"
                                                    >
                                                        {memo.title}
                                                    </Link>
                                                    {memo.posted_by && (
                                                        <p className="mt-0.5 truncate text-sm text-stone-500">
                                                            By {memo.posted_by}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="truncate px-5 py-3.5 text-sm text-stone-700">
                                                    {memo.category_label}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm">
                                                    <p className="truncate text-stone-800 tabular-nums">
                                                        {contentsLine(memo)}
                                                    </p>
                                                    {memo.file && (
                                                        <p
                                                            className="mt-0.5 truncate text-stone-500"
                                                            title={memo.file.name}
                                                        >
                                                            {memo.file.name}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm tabular-nums">
                                                    <p className="whitespace-nowrap text-stone-700">
                                                        {postedOn(memo.posted_at)}
                                                    </p>
                                                    {wasEdited(memo) && memo.updated_at && (
                                                        <p className="mt-0.5 whitespace-nowrap text-stone-500">
                                                            Edited {postedOn(memo.updated_at)}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-3.5 pr-4 pl-5 text-right">
                                                    {/* Above the row link, so these buttons get their own clicks. */}
                                                    <div className="relative z-10 inline-flex gap-1">
                                                        <Link
                                                            to={`/admin/memos/${memo.id}/edit`}
                                                            aria-label={`Edit ${memo.title}`}
                                                            className={`${iconAction} text-stone-600 hover:bg-maroon-50 hover:text-maroon-700`}
                                                        >
                                                            <EditIcon className="size-5" />
                                                            <Tip>Edit</Tip>
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            aria-label={`Delete ${memo.title}`}
                                                            onClick={() => {
                                                                remove.reset();
                                                                setRemoving(memo);
                                                            }}
                                                            className={`${iconAction} text-stone-600 hover:bg-red-50 hover:text-red-700`}
                                                        >
                                                            <TrashIcon className="size-5" />
                                                            <Tip>Delete</Tip>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {lastPage > 1 && (
                            <nav
                                aria-label="Pages"
                                className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 md:px-5"
                            >
                                <Button
                                    variant="secondary"
                                    size="md"
                                    className="max-md:min-h-12"
                                    disabled={page <= 1}
                                    onClick={() => setFilter({ page: page - 1 })}
                                >
                                    Previous
                                </Button>
                                <p className="text-sm text-stone-600 tabular-nums">
                                    Page {page} of {lastPage}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    className="max-md:min-h-12"
                                    disabled={page >= lastPage}
                                    onClick={() => setFilter({ page: page + 1 })}
                                >
                                    Next
                                </Button>
                            </nav>
                        )}
                    </div>
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

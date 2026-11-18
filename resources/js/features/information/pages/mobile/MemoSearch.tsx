// M-Memos (S5.2). Mobile first at 360 px, laid out like Alerts: brand stripe and title, a big search
// field, one row of category chips that scrolls sideways, then one card of tappable rows. Search starts
// at 2 letters after a short pause. Each chip shows how many memos it would find. A row opens the memo
// with its file in the preview pane. The search lives in the URL, so Back from a memo returns here as
// it was. Every tap target is 48 px or taller.
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ClipboardIcon } from '@/features/events/components/icons';
import { ChevronIcon, FileIcon, SearchIcon } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { fileKind, fileSize, listMemos, postedOn, type Memo } from '../../api';

const MIN_TERM = 2;
const DEBOUNCE_MS = 300;

const textLink =
    'inline-flex min-h-12 items-center rounded-sm px-2 text-base font-semibold text-maroon-700 underline-offset-2 hover:underline';

// What the memo holds, in words, so a row never relies on an icon alone. Short enough for 360 px.
// The size tells people what opening it costs on mobile data.
function contentsLine(memo: Memo): string {
    if (!memo.file) return 'Text only';
    return `${fileKind(memo.file.type)} · ${fileSize(memo.file.size)}`;
}

// Marks the searched words in a title, so it is clear why a memo matched.
function Highlight({ text, term }: { text: string; term: string }) {
    if (!term) return <>{text}</>;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                i % 2 === 1 ? (
                    <mark key={i} className="rounded-sm bg-amber-100 text-stone-900">
                        {part}
                    </mark>
                ) : (
                    part
                ),
            )}
        </>
    );
}

function MemoRow({ memo, term, search }: { memo: Memo; term: string; search: string }) {
    const kind = memo.file ? fileKind(memo.file.type) : null;
    return (
        <li>
            <Link
                to={`/me/memos/${memo.id}`}
                state={{ from: search }}
                className="flex min-h-16 items-center gap-3 p-4 transition-colors hover:bg-stone-50 active:bg-stone-100"
            >
                <span className="flex size-10 shrink-0 items-center justify-center self-start rounded-control border border-stone-200 bg-white text-maroon-700">
                    {kind ? <FileIcon className="size-5" /> : <ClipboardIcon className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="text-xs font-semibold tracking-[0.14em] text-maroon-700 uppercase">
                        {memo.category_label}
                    </span>
                    <span className="mt-0.5 line-clamp-2 font-semibold text-pretty break-words text-stone-900">
                        <Highlight text={memo.title} term={term} />
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-stone-600 tabular-nums">
                        {postedOn(memo.posted_at)} · {contentsLine(memo)}
                    </span>
                </span>
                <ChevronIcon className="size-5 shrink-0 text-stone-400" />
            </Link>
        </li>
    );
}

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3].map((row) => (
                <li key={row} aria-hidden="true" className="flex gap-3 p-4">
                    <div className="size-10 shrink-0 animate-pulse rounded-control bg-stone-200" />
                    <div className="flex-1 space-y-2.5">
                        <div className="h-3 w-20 animate-pulse rounded bg-stone-200" />
                        <div className="h-4 w-4/5 animate-pulse rounded bg-stone-200" />
                        <div className="h-3 w-2/5 animate-pulse rounded bg-stone-200" />
                    </div>
                </li>
            ))}
        </>
    );
}

function EmptyPanel({
    icon,
    title,
    children,
}: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center px-6 py-10 text-center md:py-14">
            <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 bg-white text-maroon-700">
                {icon}
            </span>
            <p className="mt-4 text-lg font-semibold text-balance text-stone-900">{title}</p>
            {children}
        </div>
    );
}

export function MemoSearch() {
    const [params, setParams] = useSearchParams();
    const q = params.get('q') ?? '';
    const category = params.get('category') ?? '';
    const [text, setText] = useState(q);
    const input = useRef<HTMLInputElement>(null);

    const setFilter = (next: { q?: string; category?: string }) => {
        const merged = { q, category, ...next };
        setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== '')), {
            replace: true,
        });
    };

    // Search waits for a short pause in typing and starts at 2 letters. Clearing is instant.
    useEffect(() => {
        const trimmed = text.trim();
        const next = trimmed.length >= MIN_TERM ? trimmed : '';
        if (next === q) return;
        const timer = window.setTimeout(
            () => setFilter({ q: next }),
            next === '' ? 0 : DEBOUNCE_MS,
        );
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    const memos = useInfiniteQuery({
        queryKey: ['memos', 'search', q, category],
        queryFn: ({ pageParam }) => listMemos({ q, category, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
        placeholderData: keepPreviousData,
    });

    const pages = memos.data?.pages ?? [];
    const rows = pages.flatMap((p) => p.data);
    const total = pages[0]?.meta.total ?? 0;
    const categories = pages[0]?.categories ?? [];
    const matches = categories.reduce((sum, c) => sum + c.count, 0);
    const filtered = q !== '' || category !== '';
    const categoryLabel = category
        ? (categories.find((c) => c.value === category)?.label ?? 'this category')
        : null;
    const tooShort = text.trim().length > 0 && text.trim().length < MIN_TERM;
    // A search is still on its way while the typed words differ from the one in the URL.
    const typing = !tooShort && text.trim() !== q && text.trim() !== '';
    const refreshing =
        (memos.isFetching && !memos.isFetchingNextPage && !memos.isPending) || typing;
    const nothingPosted = memos.isSuccess && !filtered && total === 0;

    const clear = () => {
        setText('');
        setParams({}, { replace: true });
        input.current?.focus();
    };

    const summary = memos.isPending
        ? 'Loading memos...'
        : `${total} ${total === 1 ? 'memo' : 'memos'}${q ? ` for "${q}"` : ''}${categoryLabel ? ` in ${categoryLabel}` : ''}`;

    const chips = [
        { value: '', label: 'All', count: memos.isSuccess ? matches : null },
        ...categories.map((c) => ({ value: c.value, label: c.label, count: c.count })),
    ];

    return (
        <div className="mx-auto max-w-2xl">
            <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">Memos</h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                Policies, procedures and advisories from DRRMO.
            </p>

            {memos.isError && !memos.data ? (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        The memos did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={memos.isFetching}
                        onClick={() => void memos.refetch()}
                    >
                        {memos.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            ) : nothingPosted ? (
                <div className="mt-6 rounded-card bg-white ring-1 ring-stone-200">
                    <EmptyPanel icon={<ClipboardIcon className="size-5" />} title="No memos yet">
                        <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                            When DRRMO posts a policy, procedure or advisory, you can read it here.
                        </p>
                    </EmptyPanel>
                </div>
            ) : (
                <>
                    <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-6">
                        <label htmlFor="memo-search" className="sr-only">
                            Search memos
                        </label>
                        <div className="relative">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-500" />
                            <input
                                ref={input}
                                id="memo-search"
                                type="search"
                                enterKeyHint="search"
                                autoComplete="off"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Search titles and memo text"
                                aria-describedby="memo-search-hint"
                                className="block min-h-12 w-full rounded-control border border-stone-300 bg-white pr-12 pl-11 text-base text-stone-900 shadow-xs transition-colors placeholder:text-stone-500 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
                            />
                            {text !== '' && (
                                <button
                                    type="button"
                                    onClick={clear}
                                    className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-control text-stone-500 transition-colors hover:text-stone-900 active:bg-stone-100"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="size-5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M6 6l12 12M18 6 6 18" />
                                    </svg>
                                    <span className="sr-only">Clear search</span>
                                </button>
                            )}
                        </div>
                        <p
                            id="memo-search-hint"
                            className={`mt-1.5 text-sm text-stone-600 ${tooShort ? '' : 'sr-only'}`}
                        >
                            Type at least {MIN_TERM} letters to search.
                        </p>
                    </form>

                    {/* One row that scrolls sideways, so six categories never stack into a wall of buttons.
                        Each chip is a 48 px tap target with a smaller pill drawn inside. */}
                    <div
                        role="group"
                        aria-label="Category"
                        className="-mx-6 mt-2 flex snap-x scroll-px-6 gap-1 overflow-x-auto px-6 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden"
                    >
                        {memos.isPending
                            ? [56, 96, 88, 104].map((w) => (
                                  <span
                                      key={w}
                                      className="flex min-h-12 items-center"
                                      aria-hidden="true"
                                  >
                                      <span
                                          className="h-9 animate-pulse rounded-full bg-stone-200"
                                          style={{ width: w }}
                                      />
                                  </span>
                              ))
                            : chips.map((c) => {
                                  const on = category === c.value;
                                  return (
                                      <button
                                          key={c.value}
                                          type="button"
                                          aria-pressed={on}
                                          onClick={() => setFilter({ category: c.value })}
                                          className="group flex min-h-12 shrink-0 snap-start items-center"
                                      >
                                          <span
                                              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap ring-1 transition-colors ${
                                                  on
                                                      ? 'bg-maroon-700 text-white ring-maroon-700'
                                                      : 'bg-white text-stone-700 ring-stone-300 group-hover:ring-stone-400 group-active:bg-stone-100'
                                              }`}
                                          >
                                              {c.label}
                                              {c.count !== null && (
                                                  <span
                                                      className={`tabular-nums ${on ? 'text-maroon-100' : c.count === 0 ? 'text-stone-400' : 'text-stone-500'}`}
                                                  >
                                                      {c.count}
                                                  </span>
                                              )}
                                          </span>
                                      </button>
                                  );
                              })}
                    </div>

                    <section
                        aria-label="Results"
                        aria-busy={memos.isPending || refreshing || undefined}
                        className="mt-3 overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
                    >
                        <div className="relative flex min-h-12 items-center justify-between gap-3 border-b border-stone-200 pr-2 pl-4">
                            <p
                                className="min-w-0 truncate text-sm text-stone-600 tabular-nums"
                                aria-live="polite"
                            >
                                {summary}
                            </p>
                            {filtered && (
                                <button
                                    type="button"
                                    onClick={clear}
                                    className={`${textLink} shrink-0 text-sm`}
                                >
                                    Clear
                                </button>
                            )}
                            {/* A thin line while a new search loads over the old rows. */}
                            <div
                                aria-hidden="true"
                                className={`absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-maroon-700/10 transition-opacity ${refreshing ? 'opacity-100' : 'opacity-0'}`}
                            >
                                <div className="h-full w-1/3 animate-pulse bg-maroon-700/60" />
                            </div>
                        </div>

                        {memos.isSuccess && rows.length === 0 ? (
                            <EmptyPanel
                                icon={<SearchIcon className="size-5" />}
                                title={`No memos match${q ? ` "${q}"` : ''}${categoryLabel ? ` in ${categoryLabel}` : ''}`}
                            >
                                <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                                    Try other words, check the spelling, or look in all categories.
                                </p>
                                <button
                                    type="button"
                                    onClick={clear}
                                    className={`${textLink} mt-2`}
                                >
                                    Clear search
                                </button>
                            </EmptyPanel>
                        ) : (
                            <ul
                                className={`divide-y divide-stone-100 transition-opacity ${refreshing ? 'opacity-60' : ''}`}
                            >
                                {memos.isPending && <SkeletonRows />}
                                {rows.map((m) => (
                                    <MemoRow
                                        key={m.id}
                                        memo={m}
                                        term={q}
                                        search={params.toString()}
                                    />
                                ))}
                            </ul>
                        )}
                    </section>

                    {memos.hasNextPage && (
                        <div className="mt-4 space-y-2 text-center">
                            <p className="text-sm text-stone-600 tabular-nums">
                                Showing {rows.length} of {total}
                            </p>
                            <Button
                                variant="secondary"
                                block
                                loading={memos.isFetchingNextPage}
                                onClick={() => void memos.fetchNextPage()}
                            >
                                {memos.isFetchingNextPage ? 'Loading...' : 'Show more memos'}
                            </Button>
                        </div>
                    )}
                    {memos.isError && memos.data && (
                        <div className="mt-4">
                            <Alert tone="error">
                                More memos did not load. Check your connection and try again.
                            </Alert>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

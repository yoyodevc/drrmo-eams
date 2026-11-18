// A-Memo view. Desktop first. Read a memo the way people will: the text in a readable column, then the
// file itself in a preview pane (PDF pages, Word text or the image), so nobody has to open it a second
// time. A side panel holds the memo's details. Under 1024 px everything stacks in one column.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { EditIcon, TrashIcon } from '@/features/personnel/components/ui';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { BackLink } from '@/shared/ui/BackLink';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { deleteMemo, fileKind, getMemo, postedOn, type Memo } from '../../api';
import { MemoPreview } from '../../components/MemoPreview';

// "Nov 18, 2026, 8:41 PM", for the details panel where the time helps.
const stampFormat = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});
const stamp = (iso: string) => stampFormat.format(new Date(iso));

// 48 px on phones, the denser 40 px admin size from 768 px.
const buttonBase =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-4 text-base font-semibold transition-colors md:min-h-10 md:text-sm';
const secondaryButton = `${buttonBase} border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 active:bg-stone-100`;

function Detail({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0 lg:block">
            <dt className="text-sm text-stone-500">{term}</dt>
            <dd className="text-right text-sm text-stone-800 tabular-nums lg:mt-0.5 lg:text-left">
                {children}
            </dd>
        </div>
    );
}

function Details({ memo }: { memo: Memo }) {
    const edited =
        memo.updated_at !== null &&
        Date.parse(memo.updated_at) - Date.parse(memo.posted_at) > 60_000;
    const contents = [memo.has_body && 'Text', memo.file && fileKind(memo.file.type)]
        .filter(Boolean)
        .join(' and ');
    return (
        <section
            aria-labelledby="memo-details-heading"
            className="rounded-card bg-white p-5 ring-1 ring-stone-200"
        >
            <h2
                id="memo-details-heading"
                className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase"
            >
                Details
            </h2>
            <dl className="mt-4 divide-y divide-stone-100">
                <Detail term="Category">{memo.category_label}</Detail>
                <Detail term="Posted">{stamp(memo.posted_at)}</Detail>
                <Detail term="Posted by">
                    {memo.posted_by ?? <span className="text-stone-500">Not recorded</span>}
                </Detail>
                {edited && memo.updated_at && (
                    <Detail term="Last edited">{stamp(memo.updated_at)}</Detail>
                )}
                <Detail term="Contents">{contents || 'Empty'}</Detail>
            </dl>
        </section>
    );
}

function LoadingView() {
    return (
        <div className="mx-auto max-w-6xl" aria-busy="true">
            <p role="status" className="sr-only">
                Loading the memo...
            </p>
            <div aria-hidden="true">
                <div className="h-10 w-40 animate-pulse rounded-control bg-stone-200" />
                <div className="mt-8 h-1 w-12 rounded-full bg-stone-200" />
                <div className="mt-4 h-3 w-24 animate-pulse rounded bg-stone-200" />
                <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-stone-200" />
                <div className="mt-3 h-4 w-72 animate-pulse rounded bg-stone-200" />
                <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="h-80 animate-pulse rounded-card bg-stone-200" />
                    <div className="h-56 animate-pulse rounded-card bg-stone-200" />
                </div>
            </div>
        </div>
    );
}

export function MemoView() {
    const id = Number(useParams().id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [confirming, setConfirming] = useState(false);
    // Set by the editor after a save, so this page confirms it (same pattern as RoleDetail).
    const saved = (useLocation().state as { saved?: 'posted' | 'updated' } | null)?.saved;
    const memo = useQuery({ queryKey: ['memo', id], queryFn: () => getMemo(id) });
    const remove = useMutation({
        mutationFn: () => deleteMemo(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['memos'] });
            queryClient.removeQueries({ queryKey: ['memo', id] });
            await navigate('/admin/memos', {
                replace: true,
                state: { deleted: memo.data?.title },
            });
        },
    });

    const back = <BackLink to="/admin/memos" label="Back to memos" />;

    if (memo.isPending) return <LoadingView />;

    if (memo.isError) {
        const missing = memo.error instanceof ApiError && memo.error.status === 404;
        return (
            <div className="mx-auto max-w-xl space-y-4">
                {back}
                <Alert tone="error">
                    {missing
                        ? 'This memo was deleted or does not exist. Go back to the list to find another one.'
                        : 'The memo did not load. Check your connection and try again.'}
                </Alert>
                {!missing && (
                    <Button
                        variant="secondary"
                        size="md"
                        loading={memo.isFetching}
                        onClick={() => void memo.refetch()}
                    >
                        {memo.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                )}
            </div>
        );
    }

    const m = memo.data;

    return (
        <div className="mx-auto max-w-6xl">
            {back}

            {saved && (
                <div className="mt-6 max-w-3xl">
                    <Alert tone="success">
                        {saved === 'posted'
                            ? 'Memo posted. Everyone can find it in Memos now.'
                            : 'Changes saved. Everyone sees the new version now.'}
                    </Alert>
                </div>
            )}

            <header className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 max-w-3xl">
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-maroon-700 uppercase">
                        {m.category_label}
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance break-words text-stone-900 lg:text-3xl">
                        {m.title}
                    </h1>
                    <p className="mt-2 text-sm text-stone-600">
                        Posted {postedOn(m.posted_at)}
                        {m.posted_by && ` by ${m.posted_by}`}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Link
                        to={`/admin/memos/${m.id}/edit`}
                        className={`${secondaryButton} flex-1 sm:flex-none`}
                    >
                        <EditIcon className="size-5 md:size-4" />
                        Edit
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            remove.reset();
                            setConfirming(true);
                        }}
                        className={`${buttonBase} flex-1 text-red-700 hover:bg-red-50 active:bg-red-100 sm:flex-none`}
                    >
                        <TrashIcon className="size-5 md:size-4" />
                        Delete
                    </button>
                </div>
            </header>

            <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-6">
                    {m.body && (
                        <article
                            aria-label="Memo text"
                            className="rounded-card bg-white p-5 ring-1 ring-stone-200 sm:p-8"
                        >
                            {/* About 65 characters a line, so long memos stay easy to read. */}
                            <p className="max-w-prose text-base leading-7 whitespace-pre-wrap text-stone-800 [overflow-wrap:anywhere]">
                                {m.body}
                            </p>
                        </article>
                    )}
                    <MemoPreview memo={m} />
                    {!m.body && !m.file && (
                        <div className="rounded-card bg-white p-8 text-center ring-1 ring-stone-200">
                            <p className="text-stone-600">This memo has no text or file yet.</p>
                            <Link
                                to={`/admin/memos/${m.id}/edit`}
                                className="mt-2 inline-flex min-h-12 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline md:min-h-8"
                            >
                                Add text or a file
                            </Link>
                        </div>
                    )}
                </div>

                <aside className="lg:sticky lg:top-6">
                    <Details memo={m} />
                </aside>
            </div>

            <ConfirmDialog
                open={confirming}
                tone="danger"
                title="Delete this memo?"
                description={`"${m.title}" disappears for everyone. The record stays in the audit log.`}
                confirmLabel="Delete memo"
                loading={remove.isPending}
                loadingLabel="Deleting..."
                error={remove.isError ? remove.error.message : null}
                onConfirm={() => remove.mutate()}
                onCancel={() => setConfirming(false)}
            />
        </div>
    );
}

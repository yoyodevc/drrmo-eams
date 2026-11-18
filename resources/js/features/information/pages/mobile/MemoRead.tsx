// M-Memo. One memo, read on a phone: category, title and date, the text in a readable column, then the
// file in the same preview pane as the admin memo page (PDF pages, Word as PDF, or the image), with Open
// and Download. Read only. Back returns to the search as it was.
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router';
import { BackLink } from '@/features/personnel/components/ui';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { getMemo, postedOn } from '../../api';
import { MemoPreview } from '../../components/MemoPreview';

function LoadingView() {
    return (
        <div aria-busy="true">
            <p role="status" className="sr-only">
                Loading the memo...
            </p>
            <div aria-hidden="true">
                <div className="mt-6 h-1 w-12 rounded-full bg-stone-200" />
                <div className="mt-4 h-3 w-24 animate-pulse rounded bg-stone-200" />
                <div className="mt-3 h-7 w-4/5 animate-pulse rounded bg-stone-200" />
                <div className="mt-3 h-4 w-48 animate-pulse rounded bg-stone-200" />
                <div className="mt-6 h-40 animate-pulse rounded-card bg-stone-200" />
                <div className="mt-6 h-72 animate-pulse rounded-card bg-stone-200" />
            </div>
        </div>
    );
}

export function MemoRead() {
    const id = Number(useParams().id);
    // The list passes its search along, so Back lands on the same results.
    const from = (useLocation().state as { from?: string } | null)?.from;
    const memo = useQuery({
        queryKey: ['memo', id],
        queryFn: () => getMemo(id),
        // While the server makes the PDF copy of a Word file, check every 3 seconds for 2 minutes.
        refetchInterval: (query) =>
            query.state.data?.file?.preview === 'converting' && query.state.dataUpdateCount < 40
                ? 3000
                : false,
    });

    const back = <BackLink to={`/me/memos${from ? `?${from}` : ''}`}>Memos</BackLink>;

    if (memo.isPending) {
        return (
            <div className="mx-auto max-w-3xl">
                {back}
                <LoadingView />
            </div>
        );
    }

    if (memo.isError) {
        const missing = memo.error instanceof ApiError && memo.error.status === 404;
        return (
            <div className="mx-auto max-w-2xl">
                {back}
                <div className="mt-4 space-y-3">
                    <Alert tone="error">
                        {missing
                            ? 'This memo was removed or does not exist. Go back to Memos to find another one.'
                            : 'The memo did not load. Check your connection and try again.'}
                    </Alert>
                    {!missing && (
                        <Button
                            variant="secondary"
                            block
                            loading={memo.isFetching}
                            onClick={() => void memo.refetch()}
                        >
                            {memo.isFetching ? 'Retrying...' : 'Retry'}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    const m = memo.data;

    return (
        <div className="mx-auto max-w-3xl">
            {back}

            <header className="mt-4">
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-maroon-700 uppercase">
                    {m.category_label}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance break-words text-stone-900">
                    {m.title}
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                    Posted {postedOn(m.posted_at)}
                    {m.posted_by && ` by ${m.posted_by}`}
                </p>
            </header>

            <div className="mt-6 space-y-6">
                {m.body && (
                    <article
                        aria-label="Memo text"
                        className="rounded-card bg-white p-5 ring-1 ring-stone-200 sm:p-8"
                    >
                        <p className="max-w-prose text-base leading-7 whitespace-pre-wrap text-stone-800 [overflow-wrap:anywhere]">
                            {m.body}
                        </p>
                    </article>
                )}
                <MemoPreview memo={m} />
                {!m.body && !m.file && (
                    <div className="rounded-card bg-white px-6 py-10 text-center ring-1 ring-stone-200">
                        <p className="text-base text-stone-600">This memo has no text or file.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

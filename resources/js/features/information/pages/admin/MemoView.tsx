// A-Memo view. Desktop first. Read a memo the way people will: text in a readable column, the file
// beside it. Images show inline. PDF and Word open in a new tab, because the server forbids framing
// pages (X-Frame-Options DENY in deploy/nginx.conf).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { PencilIcon } from '@/features/events/components/icons';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { BackLink } from '@/shared/ui/BackLink';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import {
    deleteMemo,
    fileKind,
    fileSize,
    getMemo,
    memoFileUrl,
    postedOn,
    type Memo,
} from '../../api';

function FileIcon({ className = 'size-6' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10Z" />
            <path d="M14 3.5v5h5" />
        </svg>
    );
}

function Attachment({ memo }: { memo: Memo }) {
    const file = memo.file;
    if (!file) return null;
    const url = memoFileUrl(memo.id);
    const kind = fileKind(file.type);

    return (
        <section
            aria-labelledby="memo-file-heading"
            className="rounded-card bg-white ring-1 ring-stone-200"
        >
            <h2 id="memo-file-heading" className="sr-only">
                Attached file
            </h2>
            {kind === 'Image' && (
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block border-b border-stone-200"
                >
                    <img
                        src={url}
                        alt={`Attached image: ${file.name}`}
                        className="max-h-[28rem] w-full rounded-t-card bg-stone-100 object-contain"
                    />
                </a>
            )}
            <div className="flex flex-wrap items-center gap-4 p-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                    <FileIcon />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900">{file.name}</span>
                    <span className="text-sm text-stone-600 tabular-nums">
                        {kind} · {fileSize(file.size)}
                    </span>
                </span>
                <span className="flex flex-wrap gap-2">
                    <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex min-h-10 items-center rounded-control px-4 text-sm font-semibold transition-colors ${
                            memo.has_body
                                ? 'border border-stone-500 bg-white text-stone-800 hover:bg-stone-50'
                                : 'bg-maroon-700 text-white hover:bg-maroon-800'
                        }`}
                    >
                        Open {kind === 'File' ? 'file' : kind}
                        <span className="sr-only"> in a new tab</span>
                    </a>
                    <a
                        href={url}
                        download={file.name}
                        className="inline-flex min-h-10 items-center rounded-control px-4 text-sm font-semibold text-maroon-700 transition-colors hover:bg-maroon-50"
                    >
                        Download
                    </a>
                </span>
            </div>
        </section>
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

    if (memo.isPending) {
        return (
            <div className="mx-auto max-w-5xl" aria-busy="true">
                <p role="status" className="sr-only">
                    Loading the memo...
                </p>
                <div aria-hidden="true">
                    <div className="h-4 w-20 animate-pulse rounded bg-stone-200" />
                    <div className="mt-6 h-4 w-24 animate-pulse rounded bg-stone-200" />
                    <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-stone-200" />
                    <div className="mt-3 h-4 w-80 animate-pulse rounded bg-stone-200" />
                    <div className="mt-8 h-64 animate-pulse rounded-card bg-stone-200" />
                </div>
            </div>
        );
    }

    if (memo.isError) {
        const missing = memo.error instanceof ApiError && memo.error.status === 404;
        return (
            <div className="mx-auto max-w-xl space-y-3">
                {back}
                <Alert tone="error">
                    {missing ? 'This memo was deleted or does not exist.' : memo.error.message}
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
    const edited = m.updated_at && Date.parse(m.updated_at) - Date.parse(m.posted_at) > 60_000;

    return (
        <div className="mx-auto max-w-5xl">
            {back}

            {saved && (
                <div className="mt-4 max-w-3xl">
                    <Alert tone="success">
                        {saved === 'posted'
                            ? 'Memo posted. Everyone can find it in Memos now.'
                            : 'Changes saved. Everyone sees the new version now.'}
                    </Alert>
                </div>
            )}

            <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-3xl">
                    <p className="text-sm font-semibold text-maroon-700">{m.category_label}</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance text-stone-900">
                        {m.title}
                    </h1>
                    <p className="mt-2 text-sm text-stone-600">
                        Posted {postedOn(m.posted_at)}
                        {m.posted_by && ` by ${m.posted_by}`}
                        {edited && m.updated_at && ` · Updated ${postedOn(m.updated_at)}`}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Link
                        to={`/admin/memos/${m.id}/edit`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-stone-500 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50"
                    >
                        <PencilIcon className="size-4" />
                        Edit
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            remove.reset();
                            setConfirming(true);
                        }}
                        className="inline-flex min-h-10 items-center rounded-control px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
                    >
                        Delete
                    </button>
                </div>
            </header>

            {/* Two columns only when there is both text and a file. */}
            <div
                className={`mt-8 grid items-start gap-6 ${m.body && m.file ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : 'max-w-3xl'}`}
            >
                {m.body && (
                    <article className="rounded-card bg-white p-6 ring-1 ring-stone-200 sm:p-8">
                        {/* About 65 characters a line, so long memos stay easy to read. */}
                        <p className="max-w-prose text-base leading-relaxed whitespace-pre-wrap text-stone-800 [overflow-wrap:anywhere]">
                            {m.body}
                        </p>
                    </article>
                )}
                <Attachment memo={m} />
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

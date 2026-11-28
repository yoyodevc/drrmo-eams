// A-Memo editor (S5.1, SCREENS.md). Desktop first. Title, category, and the text, a file, or both.
// One page for new and edit. Upload rules match the server: PDF, DOCX, JPG or PNG up to 5 MB.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { SelectField, SelectOption } from '@/features/events/components/SelectField';
import { fieldErrors } from '@/features/personnel/people';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { BackLink } from '@/shared/ui/BackLink';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';
import {
    FILE_ACCEPT,
    fileSize,
    getMemo,
    listMemos,
    MAX_FILE_BYTES,
    memoFileUrl,
    saveMemo,
    type Memo,
} from '../../api';

const BODY_MAX = 20000;

function Section({
    title,
    intro,
    children,
}: {
    title: string;
    intro: string;
    children: ReactNode;
}) {
    return (
        <section className="grid gap-x-10 gap-y-5 px-6 py-7 lg:grid-cols-3">
            <div>
                <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
                <p className="mt-1 text-sm text-pretty text-stone-600">{intro}</p>
            </div>
            <div className="space-y-5 lg:col-span-2">{children}</div>
        </section>
    );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
    return (
        <p id={id} className="mt-1.5 text-sm font-medium text-red-700">
            {children}
        </p>
    );
}

export function MemoEditor() {
    const params = useParams();
    const editingId = params.id ?? null;
    const existing = useQuery({
        queryKey: ['memo', editingId],
        queryFn: () => getMemo(editingId as string),
        enabled: editingId !== null,
    });
    // The category list comes with the memo list, which is usually cached already.
    const lookups = useQuery({
        queryKey: ['memos', { category: '', page: 1 }],
        queryFn: () => listMemos(),
    });

    if (editingId !== null && existing.isPending) {
        return (
            <div className="mx-auto max-w-5xl" aria-busy="true">
                <p role="status" className="sr-only">
                    Loading the memo...
                </p>
                <div aria-hidden="true">
                    <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                    <div className="mt-6 h-8 w-48 animate-pulse rounded bg-stone-200" />
                    <div className="mt-8 h-96 animate-pulse rounded-card bg-stone-200" />
                </div>
            </div>
        );
    }
    if (editingId !== null && existing.isError) {
        const missing = existing.error instanceof ApiError && existing.error.status === 404;
        return (
            <div className="mx-auto max-w-xl space-y-3">
                <Alert tone="error">
                    {missing ? 'This memo was deleted or does not exist.' : existing.error.message}
                </Alert>
                {missing ? (
                    <Link to="/admin/memos" className="inline-block font-semibold text-maroon-700">
                        Back to memos
                    </Link>
                ) : (
                    <Button
                        variant="secondary"
                        size="md"
                        loading={existing.isFetching}
                        onClick={() => void existing.refetch()}
                    >
                        {existing.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                )}
            </div>
        );
    }

    // Keyed so the form starts fresh with the loaded memo.
    return (
        <MemoForm
            key={existing.data?.id ?? 'new'}
            memo={existing.data ?? null}
            categories={lookups.data?.categories ?? []}
            categoriesFailed={lookups.isError}
        />
    );
}

function MemoForm({
    memo,
    categories,
    categoriesFailed,
}: {
    memo: Memo | null;
    categories: { value: string; label: string }[];
    categoriesFailed: boolean;
}) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const fileInput = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState(memo?.title ?? '');
    const [category, setCategory] = useState(memo?.category ?? '');
    const [body, setBody] = useState(memo?.body ?? '');
    const [file, setFile] = useState<File | null>(null);
    const [removeFile, setRemoveFile] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    // Unsaved work: leaving asks first, inside the app and when closing the tab (as SaveBar does).
    const dirty =
        title !== (memo?.title ?? '') ||
        category !== (memo?.category ?? '') ||
        body !== (memo?.body ?? '') ||
        file !== null ||
        removeFile;
    const leavingAfterSave = useRef(false);
    const blocker = useBlocker(() => dirty && !leavingAfterSave.current);
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const save = useMutation({
        mutationFn: () =>
            saveMemo(memo?.id ?? null, { title: title.trim(), category, body, file, removeFile }),
        onSuccess: async (saved) => {
            await queryClient.invalidateQueries({ queryKey: ['memos'] });
            await queryClient.invalidateQueries({ queryKey: ['memo'] });
            leavingAfterSave.current = true;
            // Land on the memo as readers will see it, which confirms the save.
            await navigate(`/admin/memos/${saved.id}`, {
                state: { saved: memo ? 'updated' : 'posted' },
            });
        },
    });
    // Editing goes back to the memo. A new memo goes back to the list.
    const backTo = memo ? `/admin/memos/${memo.id}` : '/admin/memos';
    const errors = fieldErrors(save.error);
    const failure = save.isError && Object.keys(errors).length === 0 ? save.error.message : null;
    const currentFile = memo?.file && !removeFile && !file ? memo.file : null;

    function pick(next: File | undefined) {
        setFileError(null);
        if (!next) return;
        if (next.size > MAX_FILE_BYTES) {
            setFileError('The file is too big. The limit is 5 MB.');
            if (fileInput.current) fileInput.current.value = '';
            return;
        }
        setFile(next);
        setRemoveFile(false);
    }

    function clearPicked() {
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!save.isPending) save.mutate();
    }

    const bodyError = errors.body;
    const fileFieldError = fileError ?? errors.file;

    return (
        <div className="mx-auto max-w-5xl">
            <BackLink to={backTo} label={memo ? 'Back to memo' : 'Back to memos'} />

            <header className="mt-4">
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    {memo ? 'Edit memo' : 'New memo'}
                </h1>
                <p className="mt-1 text-pretty text-stone-600">
                    {memo
                        ? 'Changes show for everyone as soon as you save.'
                        : 'Everyone can find it in Memos on their phone once you post it.'}
                </p>
            </header>

            <form
                onSubmit={submit}
                noValidate
                className="mt-8 divide-y divide-stone-200 rounded-card bg-white ring-1 ring-stone-200"
            >
                <Section title="Details" intro="A clear title helps people find it in search.">
                    <div className="grid gap-5 sm:grid-cols-3">
                        <TextField
                            className="sm:col-span-2"
                            label="Title"
                            placeholder="For example, Fire Drill Procedure"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            error={errors.title}
                            maxLength={160}
                            required
                        />
                        <SelectField
                            label="Category"
                            placeholder={categories.length ? 'Choose a category' : 'Loading...'}
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={categories.length === 0}
                            error={
                                errors.category ??
                                (categoriesFailed
                                    ? 'The categories did not load. Reload the page.'
                                    : null)
                            }
                            required
                        >
                            {categories.map((c) => (
                                <SelectOption key={c.value} value={c.value}>
                                    {c.label}
                                </SelectOption>
                            ))}
                        </SelectField>
                    </div>
                </Section>

                <Section
                    title="Content"
                    intro="Write the memo, attach a file, or both. At least one is needed."
                >
                    <div>
                        <div className="mb-1.5 flex items-baseline justify-between gap-4">
                            <label
                                htmlFor="memo-body"
                                className="text-sm font-medium text-stone-800"
                            >
                                Text{' '}
                                <span className="font-normal text-stone-500">
                                    (optional with a file)
                                </span>
                            </label>
                            {/* Only near the limit, so it is not noise the rest of the time. */}
                            {body.length >= BODY_MAX * 0.9 && (
                                <span
                                    aria-live="polite"
                                    className={`text-sm tabular-nums ${body.length >= BODY_MAX ? 'font-medium text-red-700' : 'text-stone-600'}`}
                                >
                                    {body.length >= BODY_MAX
                                        ? 'Limit reached'
                                        : `${(BODY_MAX - body.length).toLocaleString()} characters left`}
                                </span>
                            )}
                        </div>
                        <textarea
                            id="memo-body"
                            rows={10}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            maxLength={BODY_MAX}
                            aria-invalid={bodyError ? true : undefined}
                            aria-describedby={bodyError ? 'memo-body-error' : undefined}
                            className={`block min-h-40 w-full resize-y rounded-control border bg-white px-3.5 py-3 text-base leading-relaxed text-stone-900 transition-colors focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none ${bodyError ? 'border-red-600' : 'border-stone-500 hover:border-stone-600'}`}
                        />
                        {bodyError && <FieldError id="memo-body-error">{bodyError}</FieldError>}
                    </div>

                    <div>
                        <p
                            className="mb-1.5 text-sm font-medium text-stone-800"
                            id="memo-file-label"
                        >
                            File{' '}
                            <span className="font-normal text-stone-500">(optional with text)</span>
                        </p>
                        {currentFile || file ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-stone-500 px-3.5 py-3">
                                <span className="min-w-0">
                                    <span className="block truncate font-medium text-stone-900">
                                        {file ? file.name : currentFile?.name}
                                    </span>
                                    <span className="text-sm text-stone-500 tabular-nums">
                                        {fileSize(file ? file.size : (currentFile?.size ?? 0))}
                                        {file && memo?.file && ' · replaces the current file'}
                                    </span>
                                </span>
                                <span className="flex gap-2">
                                    {currentFile && memo && (
                                        <a
                                            href={memoFileUrl(memo.id)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex min-h-9 items-center rounded-control px-3 text-sm font-semibold text-maroon-700 hover:bg-maroon-50"
                                        >
                                            Open
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => (file ? clearPicked() : setRemoveFile(true))}
                                        className="inline-flex min-h-9 items-center rounded-control px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                                    >
                                        {file ? 'Remove' : 'Remove file'}
                                    </button>
                                </span>
                            </div>
                        ) : null}
                        <label
                            className={`${currentFile || file ? 'mt-3' : ''} inline-flex min-h-10 cursor-pointer items-center rounded-control border border-stone-500 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors focus-within:ring-3 focus-within:ring-maroon-700/15 hover:bg-stone-50`}
                        >
                            {currentFile || file ? 'Choose another file' : 'Choose a file'}
                            <input
                                ref={fileInput}
                                type="file"
                                accept={FILE_ACCEPT}
                                className="sr-only"
                                aria-labelledby="memo-file-label"
                                aria-describedby={
                                    fileFieldError ? 'memo-file-error' : 'memo-file-hint'
                                }
                                onChange={(e) => pick(e.target.files?.[0])}
                            />
                        </label>
                        {removeFile && memo?.file && (
                            <p className="mt-2 text-sm text-stone-600">
                                {memo.file.name} will be removed when you save.{' '}
                                <button
                                    type="button"
                                    onClick={() => setRemoveFile(false)}
                                    className="font-semibold text-maroon-700 underline underline-offset-2"
                                >
                                    Keep it
                                </button>
                            </p>
                        )}
                        {fileFieldError ? (
                            <FieldError id="memo-file-error">{fileFieldError}</FieldError>
                        ) : (
                            <p id="memo-file-hint" className="mt-1.5 text-sm text-stone-500">
                                PDF, Word (DOCX), JPG or PNG. Up to 5 MB.
                            </p>
                        )}
                    </div>
                </Section>

                <div className="space-y-4 rounded-b-card bg-stone-50 px-6 py-4">
                    {failure && <Alert tone="error">{failure}</Alert>}
                    {!failure && Object.keys(errors).length > 0 && (
                        <Alert tone="error">
                            Some fields need a fix. Check the messages above.
                        </Alert>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <Link
                            to={backTo}
                            className="inline-flex min-h-10 items-center rounded-control border border-stone-500 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 active:bg-stone-100"
                        >
                            Cancel
                        </Link>
                        <Button type="submit" size="md" loading={save.isPending}>
                            {save.isPending ? 'Saving...' : memo ? 'Save changes' : 'Post memo'}
                        </Button>
                    </div>
                </div>
            </form>

            <ConfirmDialog
                open={blocker.state === 'blocked'}
                tone="danger"
                title="Discard your changes?"
                description="What you changed in this memo has not been saved and will be lost."
                confirmLabel="Discard changes"
                cancelLabel="Keep editing"
                onConfirm={() => blocker.proceed?.()}
                onCancel={() => blocker.reset?.()}
            />
        </div>
    );
}

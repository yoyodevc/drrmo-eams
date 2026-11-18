// The memo's file, shown right on the memo page so nobody has to open it a second time.
// PDF pages are drawn with pdf.js (its legacy build, because the modern one needs very new browser
// features such as Map.getOrInsertComputed). A Word file shows the PDF copy the server makes with
// LibreOffice, so it looks exactly like Word. Until that copy is ready, or where the server has no
// LibreOffice, docx-preview draws a quick version in the browser. Both libraries load only when needed.
// We fetch the file and draw it ourselves instead of using an iframe, because the server forbids framing
// pages (X-Frame-Options DENY in deploy/nginx.conf) and phone browsers do not show a PDF inside a page.
// No fetch here: the bytes come from api.ts.
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DownloadIcon, FileIcon } from '@/features/personnel/components/ui';
import { fetchMemoBytes, fileKind, fileSize, memoFileUrl, memoPreviewUrl, type Memo } from '../api';

// Long files stop here, so a phone does not draw hundreds of pages. The rest is one tap away.
const MAX_PAGES = 30;

const ExternalIcon = ({ className = 'size-4' }: { className?: string }) => (
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
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
);

const toolButton =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-3 text-base font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 md:min-h-9 md:text-sm';

function Sheet() {
    return (
        <div
            aria-hidden="true"
            className="mx-auto aspect-[1/1.414] w-full max-w-3xl animate-pulse rounded-sm bg-white ring-1 ring-stone-200"
        >
            <div className="space-y-3 p-[8%]">
                <div className="h-4 w-1/2 rounded bg-stone-200" />
                <div className="h-3 w-full rounded bg-stone-100" />
                <div className="h-3 w-11/12 rounded bg-stone-100" />
                <div className="h-3 w-4/5 rounded bg-stone-100" />
            </div>
        </div>
    );
}

// Draws each PDF page on a canvas as wide as the pane, sharp on high density screens.
function PdfPages({
    data,
    onPages,
}: {
    data: ArrayBuffer;
    onPages: (shown: number, total: number) => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const el = host.current;
        if (!el) return;
        void (async () => {
            try {
                const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
                const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
                pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
                // pdf.js takes the buffer over, so give it a copy and keep ours for a redraw.
                const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
                const count = Math.min(doc.numPages, MAX_PAGES);
                const width = Math.min(el.clientWidth || 768, 768);
                const ratio = window.devicePixelRatio || 1;
                // Each run draws into its own box, so a stale run (React runs effects twice in
                // development) can never wipe the pages of the current one.
                if (cancelled) return;
                const out = document.createElement('div');
                out.className = 'space-y-4';
                el.replaceChildren(out);
                for (let n = 1; n <= count && !cancelled; n++) {
                    const page = await doc.getPage(n);
                    const base = page.getViewport({ scale: 1 });
                    const viewport = page.getViewport({ scale: (width / base.width) * ratio });
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);
                    canvas.className =
                        'mx-auto block h-auto w-full max-w-3xl rounded-sm bg-white ring-1 ring-stone-200';
                    canvas.setAttribute('role', 'img');
                    canvas.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`);
                    // In the page before drawing: pdf.js does not finish drawing on a detached canvas.
                    out.append(canvas);
                    await page.render({ canvas, viewport }).promise;
                    if (cancelled) return;
                    setReady(true);
                    onPages(n, doc.numPages);
                }
            } catch (error) {
                console.error('Memo preview failed', error);
                if (!cancelled) setFailed(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [data, onPages]);

    if (failed) return <PreviewProblem />;
    return (
        <>
            {/* Filled by the effect above, so React keeps no children of its own in it. */}
            <div ref={host} />
            {!ready && <Sheet />}
        </>
    );
}

// Lays a Word file out as real pages at their true size, portrait or landscape, then scales each page
// down to fit the pane. Reflowing the text into our column broke text boxes and tables, so we keep the
// layout and shrink it instead.
function DocxPages({ data, converting }: { data: ArrayBuffer; converting: boolean }) {
    const host = useRef<HTMLDivElement>(null);
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const el = host.current;
        if (!el) return;
        // CSS zoom shrinks the page and the space it takes, so pages stack without gaps.
        const fit = () => {
            const room = el.clientWidth;
            el.querySelectorAll<HTMLElement>('section.docx').forEach((page) => {
                page.style.zoom = '1';
                const scale = Math.min(1, room / page.offsetWidth);
                page.style.zoom = String(scale);
            });
        };
        const resize = new ResizeObserver(fit);
        void (async () => {
            try {
                const { renderAsync } = await import('docx-preview');
                // Drawn off to the side, then swapped in, so a stale run cannot leave half a file.
                const out = document.createElement('div');
                await renderAsync(data, out, undefined, {
                    inWrapper: false,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                    useBase64URL: true,
                });
                if (cancelled) return;
                el.replaceChildren(out);
                fit();
                resize.observe(el);
                setReady(true);
            } catch (error) {
                console.error('Memo preview failed', error);
                if (!cancelled) setFailed(true);
            }
        })();
        return () => {
            cancelled = true;
            resize.disconnect();
        };
    }, [data]);

    if (failed) return <PreviewProblem />;
    return (
        <>
            {/* Filled by the effect above. Pages get the same white sheet look as PDF pages. */}
            <div
                ref={host}
                className="mx-auto max-w-5xl text-black [&_section.docx]:mx-auto [&_section.docx]:mb-4 [&_section.docx]:bg-white [&_section.docx]:rounded-sm [&_section.docx]:shadow-none [&_section.docx]:ring-1 [&_section.docx]:ring-stone-200 [&_section.docx:last-child]:mb-0"
            />
            {!ready && <Sheet />}
            {ready && !converting && (
                <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-pretty text-stone-600">
                    This is a quick preview. Text boxes, shapes and some fonts may look different
                    from Word. Download the file to see the exact layout.
                </p>
            )}
        </>
    );
}

function PreviewProblem({ message = 'The preview could not be shown.' }: { message?: string }) {
    return (
        <div className="flex flex-col items-center px-5 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 bg-white text-stone-500">
                <FileIcon className="size-6" />
            </span>
            <p className="mt-4 font-semibold text-stone-900">{message}</p>
            <p className="mt-1 max-w-sm text-sm text-pretty text-stone-600">
                Open it in a new tab or download it instead.
            </p>
        </div>
    );
}

export function MemoPreview({ memo }: { memo: Memo }) {
    const file = memo.file;
    const kind = file ? fileKind(file.type) : 'File';
    const canDraw = kind === 'PDF' || kind === 'Word';
    const [pages, setPages] = useState<{ shown: number; total: number } | null>(null);
    const onPages = useCallback((shown: number, total: number) => setPages({ shown, total }), []);

    // A Word file with a ready PDF copy is shown as that PDF.
    const asPdf = kind === 'PDF' || (kind === 'Word' && file?.preview === 'ready');
    const converting = kind === 'Word' && file?.preview === 'converting';
    const source = kind === 'Word' && asPdf ? memoPreviewUrl(memo.id) : memoFileUrl(memo.id);

    const content = useQuery({
        queryKey: ['memo-file', memo.id, memo.updated_at, source],
        queryFn: () => fetchMemoBytes(source),
        enabled: file !== null && canDraw,
        staleTime: Infinity,
        gcTime: 60_000,
    });

    if (!file) return null;
    const url = memoFileUrl(memo.id);
    // Open shows the PDF copy of a Word file, since a browser cannot open Word itself.
    const openUrl = asPdf ? source : url;

    return (
        <section
            aria-labelledby="memo-preview-heading"
            className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
        >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200 px-4 py-3 sm:px-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                    <FileIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1 basis-56">
                    <h2
                        id="memo-preview-heading"
                        className="truncate font-semibold text-stone-900"
                        title={file.name}
                    >
                        {file.name}
                    </h2>
                    <p className="text-sm text-stone-600 tabular-nums">
                        {kind} · {fileSize(file.size)}
                        {pages && ` · ${pages.total} ${pages.total === 1 ? 'page' : 'pages'}`}
                    </p>
                </div>
                <div className="flex w-full gap-1 sm:w-auto">
                    {(kind !== 'Word' || asPdf) && (
                        <a
                            href={openUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`${toolButton} flex-1 sm:flex-none`}
                        >
                            <ExternalIcon className="size-5 md:size-4" />
                            {kind === 'Word' ? 'Open as PDF' : 'Open'}
                            <span className="sr-only"> {file.name} in a new tab</span>
                        </a>
                    )}
                    <a
                        href={url}
                        download={file.name}
                        className={`${toolButton} flex-1 sm:flex-none`}
                    >
                        <DownloadIcon className="size-5 md:size-4" />
                        Download
                        <span className="sr-only"> {file.name}</span>
                    </a>
                </div>
            </div>

            <div
                className="bg-stone-100 p-3 sm:p-6"
                aria-busy={content.isPending && canDraw ? true : undefined}
            >
                {converting && (
                    <p
                        role="status"
                        className="mx-auto mb-4 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-stone-600"
                    >
                        <span
                            aria-hidden="true"
                            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-stone-300 border-t-maroon-700"
                        />
                        Preparing an exact copy. This quick preview is replaced when it is ready.
                    </p>
                )}
                {kind === 'Image' ? (
                    <a href={url} target="_blank" rel="noreferrer" className="block">
                        <img
                            src={url}
                            alt={`Attached image: ${file.name}`}
                            className="mx-auto max-h-[44rem] w-auto max-w-full rounded-sm bg-white object-contain ring-1 ring-stone-200"
                        />
                        <span className="sr-only"> (opens full size in a new tab)</span>
                    </a>
                ) : !canDraw ? (
                    <PreviewProblem message="There is no preview for this kind of file." />
                ) : content.isError ? (
                    <div className="text-center">
                        <PreviewProblem message="The preview did not load." />
                        <button
                            type="button"
                            onClick={() => void content.refetch()}
                            className="-mt-6 mb-6 inline-flex min-h-12 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline md:min-h-8"
                        >
                            Try again
                        </button>
                    </div>
                ) : content.isPending ? (
                    <>
                        <p role="status" className="sr-only">
                            Loading the preview...
                        </p>
                        <Sheet />
                    </>
                ) : asPdf ? (
                    <PdfPages data={content.data} onPages={onPages} />
                ) : (
                    <DocxPages data={content.data} converting={converting} />
                )}

                {pages && pages.total > MAX_PAGES && pages.shown === MAX_PAGES && (
                    <p className="mt-4 text-center text-sm text-stone-600">
                        Showing the first {MAX_PAGES} of {pages.total} pages.{' '}
                        <a
                            href={openUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-maroon-700 underline-offset-2 hover:underline"
                        >
                            Open the PDF
                        </a>{' '}
                        to read the rest.
                    </p>
                )}
            </div>
        </section>
    );
}

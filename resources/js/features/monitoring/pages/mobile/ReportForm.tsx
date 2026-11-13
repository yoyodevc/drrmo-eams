// M-Report form (S4.6). A designated reporter writes a short summary and may add a photo.
// Mobile first at 360 px. The text is kept on the phone as a draft, so a dropped connection loses nothing.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { listReportSlots, submitReport } from '../../api';
import { clearDraft, isNetworkError, MAX_SUMMARY, readDraft, saveDraft } from '../../reportDraft';
import { resizePhoto } from '../../resizePhoto';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function ReportForm() {
    const slotId = Number(useParams().id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const slots = useQuery({ queryKey: ['report-slots'], queryFn: listReportSlots });
    const slot = slots.data?.find((s) => s.id === slotId);

    const [summary, setSummary] = useState(() => readDraft(slotId));
    const [photo, setPhoto] = useState<Blob | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    const send = useMutation({
        mutationFn: () => submitReport(slotId, summary.trim(), photo),
        onSuccess: async () => {
            clearDraft(slotId);
            await queryClient.invalidateQueries({ queryKey: ['report-slots'] });
            void navigate('/me', { replace: true });
        },
    });

    function onText(value: string) {
        setSummary(value);
        saveDraft(slotId, value);
    }

    async function onPhoto(file: File | undefined) {
        setPhotoError(null);
        if (!file) return;
        try {
            setPhoto(await resizePhoto(file));
            setPhotoName(file.name);
        } catch {
            setPhoto(null);
            setPhotoName(null);
            setPhotoError('This photo could not be prepared. Try another one.');
        }
    }

    if (slots.isPending) return <p className="text-stone-600">Loading...</p>;
    if (!slot) {
        return (
            <div>
                <Alert tone="error">This report is not available to you.</Alert>
                <Link to="/me" className="mt-4 inline-block font-semibold text-maroon-700">
                    Back to my duties
                </Link>
            </div>
        );
    }

    const done = slot.status === 'submitted' || slot.status === 'late';
    const tooLong = summary.length > MAX_SUMMARY;
    const offline = send.error !== null && isNetworkError(send.error);

    return (
        <div className="mx-auto max-w-2xl">
            <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                Site report
            </h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                {slot.event} · due {clock.format(new Date(slot.due_at))}
                {slot.status === 'overdue' && ' (overdue)'}
            </p>

            {done ? (
                <div className="mt-6">
                    <Alert tone="success">
                        This report was sent{slot.status === 'late' ? ' late' : ''}. Thank you.
                    </Alert>
                    {slot.summary && (
                        <p className="mt-4 text-base whitespace-pre-wrap text-stone-800">
                            {slot.summary}
                        </p>
                    )}
                </div>
            ) : (
                <form
                    className="mt-6"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!send.isPending) send.mutate();
                    }}
                >
                    <label
                        htmlFor="report-summary"
                        className="block text-sm font-medium text-stone-800"
                    >
                        What is happening at your post?
                    </label>
                    <textarea
                        id="report-summary"
                        value={summary}
                        onChange={(e) => onText(e.target.value)}
                        rows={7}
                        required
                        aria-describedby="report-count"
                        className="mt-1.5 block w-full rounded-control border border-stone-300 bg-white px-3.5 py-3 text-base text-stone-900 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none"
                    />
                    <p
                        id="report-count"
                        className={`mt-1 text-sm tabular-nums ${tooLong ? 'text-red-700' : 'text-stone-500'}`}
                    >
                        {summary.length} of {MAX_SUMMARY} characters
                    </p>

                    <div className="mt-5">
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="sr-only"
                            tabIndex={-1}
                            onChange={(e) => void onPhoto(e.target.files?.[0])}
                        />
                        <Button
                            type="button"
                            variant="secondary"
                            block
                            onClick={() => fileInput.current?.click()}
                        >
                            {photo ? 'Change photo' : 'Add photo (optional)'}
                        </Button>
                        {photoName && photo && (
                            <p className="mt-2 text-sm text-stone-600">
                                {photoName} is ready ({Math.round(photo.size / 1024)} KB).{' '}
                                <button
                                    type="button"
                                    className="font-semibold text-maroon-700"
                                    onClick={() => {
                                        setPhoto(null);
                                        setPhotoName(null);
                                    }}
                                >
                                    Remove
                                </button>
                            </p>
                        )}
                        {photoError && <p className="mt-2 text-sm text-red-700">{photoError}</p>}
                    </div>

                    {offline && (
                        <div className="mt-5">
                            <Alert tone="error">
                                You are offline. Your text is saved on this phone. Send it again
                                when you have a connection.
                            </Alert>
                        </div>
                    )}
                    {send.error && !offline && (
                        <div className="mt-5">
                            <Alert tone="error">{send.error.message}</Alert>
                        </div>
                    )}

                    <Button
                        type="submit"
                        block
                        className="mt-6"
                        loading={send.isPending}
                        disabled={summary.trim() === '' || tooLong}
                    >
                        {send.isPending ? 'Sending...' : 'Send report'}
                    </Button>
                </form>
            )}
        </div>
    );
}

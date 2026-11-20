// On the duty card of a person who is on duty: send an emergency, and see how each one is going.
// Without signal the report is queued and the person is told it has not gone out yet.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import {
    emergencyTypes,
    listMyEmergencies,
    sendEmergency,
    type EmergencyType,
    type MyEmergency,
} from '../api';
import { blobToDataUrl, enqueueEmergency, newClientId } from '../emergencyQueue';
import { QUEUE_EVENT } from '../hooks/useEmergencyOutbox';
import { isNetworkError } from '../reportDraft';
import { resizePhoto } from '../resizePhoto';
import { StatusChip, TypeIcon, type ChipKey } from './emergencyUi';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function statusSentence(e: MyEmergency): string {
    const at = (iso: string | null) => (iso ? clock.format(new Date(iso)) : '');
    switch (e.status) {
        case 'acknowledged':
            return `Acknowledged by ${e.acknowledged_by ?? 'DRRMO'} at ${at(e.acknowledged_at)}.`;
        case 'resolved':
            return `Resolved at ${at(e.resolved_at)}.${e.resolution_note ? ` ${e.resolution_note}` : ''}`;
        case 'escalated':
            return 'Escalated. Nobody has acknowledged it yet, so the admins were alerted.';
        default:
            return 'Sent. Waiting for someone to acknowledge it.';
    }
}

// One quiet card with hairline rows. Red only marks what is still open.
export function MyEmergencyList() {
    const list = useQuery({
        queryKey: ['my-emergencies'],
        queryFn: listMyEmergencies,
        refetchInterval: 20_000,
    });
    const items = list.data ?? [];
    if (items.length === 0) return null;

    return (
        <section className="mt-6" aria-label="My emergency reports">
            <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                Your emergency reports
            </h3>
            <ul className="mt-2 divide-y divide-stone-100 rounded-card bg-white ring-1 ring-stone-200">
                {items.map((e) => {
                    const open = e.status === 'sent' || e.status === 'escalated';
                    return (
                        <li key={e.id} className="flex gap-3 px-4 py-3.5">
                            <TypeIcon
                                type={e.type}
                                className={`mt-0.5 size-5 shrink-0 ${open ? 'text-red-700' : 'text-stone-400'}`}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                    <p className="font-medium text-stone-900 capitalize">
                                        {e.type}
                                        <span className="font-normal text-stone-500 tabular-nums">
                                            {' '}
                                            · {clock.format(new Date(e.sent_at))}
                                        </span>
                                    </p>
                                    <StatusChip
                                        kind={e.status as ChipKey}
                                        label={e.status === 'sent' ? 'Not seen yet' : undefined}
                                    />
                                </div>
                                <p className="mt-0.5 text-sm text-pretty text-stone-600">
                                    {statusSentence(e)}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

// showList false leaves "Your emergency reports" to the page, so it can sit outside a card.
export function EmergencySender({
    assignmentId,
    showList = true,
}: {
    assignmentId: number;
    showList?: boolean;
}) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [type, setType] = useState<EmergencyType>('medical');
    const [note, setNote] = useState('');
    const [photo, setPhoto] = useState<Blob | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [queued, setQueued] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const send = useMutation({
        mutationFn: async () => {
            const clientId = newClientId();
            try {
                await sendEmergency({ assignmentId, clientId, type, note: note.trim(), photo });
                return 'sent' as const;
            } catch (error) {
                if (!isNetworkError(error)) throw error;
                enqueueEmergency({
                    client_id: clientId,
                    assignment_id: assignmentId,
                    type,
                    note: note.trim(),
                    photo: photo ? await blobToDataUrl(photo) : null,
                    queued_at: new Date().toISOString(),
                });
                window.dispatchEvent(new Event(QUEUE_EVENT));
                return 'queued' as const;
            }
        },
        onSuccess: async (result) => {
            setQueued(result === 'queued');
            setOpen(false);
            setNote('');
            setPhoto(null);
            await queryClient.invalidateQueries({ queryKey: ['my-emergencies'] });
        },
    });

    async function onPhoto(file: File | undefined) {
        setPhotoError(null);
        if (!file) return;
        try {
            setPhoto(await resizePhoto(file));
        } catch {
            setPhoto(null);
            setPhotoError('This photo could not be prepared. Try another one.');
        }
    }

    return (
        <div className="mt-3">
            {queued && (
                <div
                    role="status"
                    className="mb-3 rounded-card bg-amber-50 p-4 text-amber-950 ring-1 ring-amber-300"
                >
                    <p className="font-semibold">Not sent yet</p>
                    <p className="mt-1 text-sm text-pretty">
                        There is no signal. Your emergency is saved on this phone and goes out by
                        itself when you are back online. If it is urgent, call your marshal or the
                        DRRMO.
                    </p>
                </div>
            )}

            {!open ? (
                <Button
                    block
                    variant="danger"
                    onClick={() => {
                        setQueued(false);
                        setOpen(true);
                    }}
                >
                    <TypeIcon type="other" className="size-5" />
                    Report an emergency
                </Button>
            ) : (
                <form
                    className="rounded-card bg-white ring-1 ring-stone-200"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!send.isPending) send.mutate();
                    }}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
                        <p className="font-semibold text-stone-900">Report an emergency</p>
                        <span className="text-xs font-semibold tracking-wide text-red-700 uppercase">
                            Urgent
                        </span>
                    </div>
                    <div className="p-4">
                        <fieldset>
                            <legend className="text-sm font-medium text-stone-800">
                                What kind of emergency?
                            </legend>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {emergencyTypes.map((t) => {
                                    const on = type === t.value;
                                    return (
                                        <label
                                            key={t.value}
                                            className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-control border px-3 text-base transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maroon-600 ${on ? 'border-red-700 bg-red-50 font-semibold text-red-900 ring-1 ring-red-700 ring-inset' : 'border-stone-300 bg-white font-medium text-stone-800 hover:bg-stone-50 active:bg-stone-100'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="emergency-type"
                                                value={t.value}
                                                checked={on}
                                                onChange={() => setType(t.value)}
                                                className="sr-only"
                                            />
                                            <TypeIcon
                                                type={t.value}
                                                className={`size-5 shrink-0 ${on ? 'text-red-700' : 'text-stone-500'}`}
                                            />
                                            {t.label}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <label
                            htmlFor="emergency-note"
                            className="mt-4 block text-sm font-medium text-stone-800"
                        >
                            Short note{' '}
                            <span className="font-normal text-stone-500">(optional)</span>
                        </label>
                        <textarea
                            id="emergency-note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={500}
                            rows={2}
                            placeholder="What happened and who needs help"
                            className="mt-1.5 block w-full rounded-control border border-stone-300 bg-white px-3.5 py-3 text-base text-stone-900 transition-colors placeholder:text-stone-400 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none"
                        />

                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="sr-only"
                            tabIndex={-1}
                            onChange={(e) => void onPhoto(e.target.files?.[0])}
                        />
                        <button
                            type="button"
                            className="mt-2 inline-flex min-h-12 items-center text-sm font-semibold text-maroon-700"
                            onClick={() => fileInput.current?.click()}
                        >
                            {photo ? 'Photo added. Change photo' : 'Add a photo (optional)'}
                        </button>
                        {photoError && <p className="text-sm text-red-700">{photoError}</p>}

                        {send.isError && (
                            <div className="mt-3">
                                <Alert tone="error">
                                    {send.error instanceof Error
                                        ? send.error.message
                                        : 'The emergency was not sent.'}
                                </Alert>
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="danger"
                            block
                            className="mt-3"
                            loading={send.isPending}
                        >
                            {send.isPending ? 'Sending...' : 'Send emergency'}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            block
                            className="mt-1 text-stone-700 hover:bg-stone-100"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <p className="mt-2 text-center text-xs text-pretty text-stone-500">
                            Your latest location ping is sent with it.
                        </p>
                    </div>
                </form>
            )}

            {showList && <MyEmergencyList />}
        </div>
    );
}

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

export function MyEmergencyList() {
    const list = useQuery({
        queryKey: ['my-emergencies'],
        queryFn: listMyEmergencies,
        refetchInterval: 20_000,
    });
    const items = list.data ?? [];
    if (items.length === 0) return null;

    return (
        <section className="mt-4" aria-label="My emergency reports">
            <h3 className="text-xs font-semibold tracking-[0.14em] text-stone-600 uppercase">
                Your emergency reports
            </h3>
            <ul className="mt-2 space-y-2">
                {items.map((e) => {
                    const open = e.status === 'sent' || e.status === 'escalated';
                    return (
                        <li
                            key={e.id}
                            className={`flex gap-3 rounded-card bg-white p-3 ring-1 ${e.status === 'escalated' ? 'ring-red-300' : 'ring-stone-200'}`}
                        >
                            <span
                                className={`flex size-10 shrink-0 items-center justify-center rounded-control ring-1 ${open ? 'text-red-700 ring-red-200' : 'text-stone-500 ring-stone-200'}`}
                            >
                                <TypeIcon type={e.type} className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                    <p className="font-semibold text-stone-900 capitalize">
                                        {e.type}
                                    </p>
                                    <StatusChip
                                        kind={e.status as ChipKey}
                                        label={
                                            e.status === 'sent' ? 'Sent, not seen yet' : undefined
                                        }
                                    />
                                </div>
                                <p className="text-sm text-stone-600 tabular-nums">
                                    Sent {clock.format(new Date(e.sent_at))}
                                </p>
                                <p className="mt-1 text-sm text-pretty text-stone-700">
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

export function EmergencySender({ assignmentId }: { assignmentId: number }) {
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
                <div className="mb-3">
                    <div
                        role="status"
                        className="rounded-card border-2 border-amber-400 bg-amber-50 p-4 text-amber-950"
                    >
                        <p className="text-base font-bold">Not sent yet</p>
                        <p className="mt-1 text-sm text-pretty">
                            There is no signal. Your emergency is saved on this phone and goes out
                            by itself when you are back online. If it is urgent, call your marshal
                            or the DRRMO.
                        </p>
                    </div>
                </div>
            )}

            {!open ? (
                <Button
                    block
                    variant="danger"
                    className="min-h-14 text-lg"
                    onClick={() => {
                        setQueued(false);
                        setOpen(true);
                    }}
                >
                    <TypeIcon type="other" className="size-6" />
                    Report an emergency
                </Button>
            ) : (
                <form
                    className="rounded-card border-t-4 border-red-700 bg-white p-4 ring-1 ring-red-200"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!send.isPending) send.mutate();
                    }}
                >
                    <fieldset>
                        <legend className="text-lg font-semibold text-stone-900">
                            What kind of emergency?
                        </legend>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            {emergencyTypes.map((t) => (
                                <label
                                    key={t.value}
                                    className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 px-3 text-lg font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maroon-600 ${type === t.value ? 'border-red-700 bg-red-700 text-white' : 'border-stone-300 bg-white text-stone-800 active:bg-stone-100'}`}
                                >
                                    <input
                                        type="radio"
                                        name="emergency-type"
                                        value={t.value}
                                        checked={type === t.value}
                                        onChange={() => setType(t.value)}
                                        className="sr-only"
                                    />
                                    <TypeIcon type={t.value} className="size-8" />
                                    {t.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <label
                        htmlFor="emergency-note"
                        className="mt-4 block text-sm font-medium text-stone-800"
                    >
                        Short note (optional)
                    </label>
                    <textarea
                        id="emergency-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                        rows={3}
                        className="mt-1.5 block w-full rounded-control border border-stone-300 bg-white px-3.5 py-3 text-base text-stone-900 focus:border-maroon-700 focus:outline-none"
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
                    <Button
                        type="button"
                        variant="secondary"
                        block
                        className="mt-3"
                        onClick={() => fileInput.current?.click()}
                    >
                        {photo ? 'Change photo' : 'Add photo (optional)'}
                    </Button>
                    {photoError && <p className="mt-1 text-sm text-red-700">{photoError}</p>}

                    <p className="mt-3 text-sm text-stone-600">
                        Your place from your latest location ping is sent with it.
                    </p>

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
                        className="mt-5 min-h-14 text-lg"
                        loading={send.isPending}
                    >
                        {send.isPending ? 'Sending...' : 'Send emergency'}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        block
                        className="mt-2"
                        onClick={() => setOpen(false)}
                    >
                        Cancel
                    </Button>
                </form>
            )}

            <MyEmergencyList />
        </div>
    );
}

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
        <ul className="mt-3 space-y-2" aria-label="My emergency reports">
            {items.map((e) => (
                <li
                    key={e.id}
                    className="rounded-control bg-white px-3 py-2 text-sm ring-1 ring-stone-200"
                >
                    <p className="font-semibold text-stone-900 capitalize">
                        {e.type} · {e.status}
                        <span className="ml-1 font-normal text-stone-500">
                            sent {clock.format(new Date(e.sent_at))}
                        </span>
                    </p>
                    <p className="text-stone-700">{statusSentence(e)}</p>
                </li>
            ))}
        </ul>
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
                    <Alert tone="warning">
                        Not sent yet. There is no signal, so your emergency is saved on this phone
                        and will go out when you are back online.
                    </Alert>
                </div>
            )}

            {!open ? (
                <Button
                    block
                    className="bg-red-700 text-white hover:bg-red-800"
                    onClick={() => {
                        setQueued(false);
                        setOpen(true);
                    }}
                >
                    Report an emergency
                </Button>
            ) : (
                <form
                    className="rounded-card bg-white p-4 ring-1 ring-red-200"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!send.isPending) send.mutate();
                    }}
                >
                    <fieldset>
                        <legend className="text-sm font-semibold text-stone-900">
                            What kind of emergency?
                        </legend>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {emergencyTypes.map((t) => (
                                <label
                                    key={t.value}
                                    className={`flex min-h-12 items-center justify-center rounded-control border px-3 text-base font-medium ${type === t.value ? 'border-red-700 bg-red-50 text-red-800' : 'border-stone-300 text-stone-800'}`}
                                >
                                    <input
                                        type="radio"
                                        name="emergency-type"
                                        value={t.value}
                                        checked={type === t.value}
                                        onChange={() => setType(t.value)}
                                        className="sr-only"
                                    />
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

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-red-700 text-white hover:bg-red-800"
                            loading={send.isPending}
                        >
                            {send.isPending ? 'Sending...' : 'Send emergency'}
                        </Button>
                    </div>
                </form>
            )}

            <MyEmergencyList />
        </div>
    );
}

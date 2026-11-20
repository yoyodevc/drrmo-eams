// Emergency inbox for the people who review emergencies: the two global reviewer marshals (on their
// phone) and admins (on desktop). One page for both. Opening a report loads its place, and the
// server audits that. Functional first: styling comes later.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import {
    acknowledgeEmergency,
    emergencyPhotoUrl,
    getEmergency,
    listEmergencies,
    resolveEmergency,
    type ReviewEmergency,
} from '../api';

const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function stateLabel(e: ReviewEmergency): string {
    if (e.status === 'resolved') return 'Resolved';
    if (e.status === 'acknowledged') return 'Acknowledged';
    return e.escalated ? 'Escalated, not acknowledged' : 'New, not acknowledged';
}

function Detail({ id, onChanged }: { id: number; onChanged: () => void }) {
    const detail = useQuery({
        queryKey: ['emergency', id],
        queryFn: () => getEmergency(id),
        staleTime: 0,
        gcTime: 0,
    });
    const [note, setNote] = useState('');
    const ack = useMutation({ mutationFn: () => acknowledgeEmergency(id), onSuccess: onChanged });
    const resolve = useMutation({
        mutationFn: () => resolveEmergency(id, note.trim()),
        onSuccess: onChanged,
    });

    if (detail.isPending) return <p className="mt-3 text-sm text-stone-600">Loading...</p>;
    if (detail.isError)
        return (
            <div className="mt-3">
                <Alert tone="error">This emergency did not load.</Alert>
            </div>
        );
    const e = detail.data;
    const loc = e.location;
    const failed = ack.error ?? resolve.error;

    return (
        <div className="mt-3 space-y-3 border-t border-stone-100 pt-3 text-sm">
            {e.note && <p className="whitespace-pre-wrap text-stone-800">{e.note}</p>}
            {loc ? (
                <p>
                    Place from their last ping (
                    {loc.captured_at ? stamp.format(new Date(loc.captured_at)) : 'time unknown'}
                    {loc.accuracy_m ? `, within ${loc.accuracy_m} m` : ''}):{' '}
                    <a
                        className="font-semibold text-maroon-700 underline"
                        href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=18/${loc.lat}/${loc.lng}`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open the map
                    </a>
                </p>
            ) : (
                <p className="text-stone-600">No location was available for this report.</p>
            )}
            {e.has_photo && (
                <img
                    src={emergencyPhotoUrl(e.id)}
                    alt="Photo sent with the emergency"
                    className="max-h-80 max-w-full rounded-control object-contain"
                />
            )}
            {e.acknowledged_at && (
                <p className="text-stone-600">
                    Acknowledged by {e.acknowledged_by ?? 'someone'} at{' '}
                    {stamp.format(new Date(e.acknowledged_at))}.
                </p>
            )}
            {e.resolved_at && (
                <p className="text-stone-600">
                    Resolved by {e.resolved_by ?? 'someone'} at{' '}
                    {stamp.format(new Date(e.resolved_at))}.
                    {e.resolution_note ? ` ${e.resolution_note}` : ''}
                </p>
            )}
            {failed && <Alert tone="error">{failed.message}</Alert>}
            {e.status === 'sent' && (
                <Button loading={ack.isPending} onClick={() => ack.mutate()}>
                    Acknowledge
                </Button>
            )}
            {e.status !== 'resolved' && (
                <div>
                    <label htmlFor={`resolve-${e.id}`} className="block font-medium text-stone-800">
                        Resolution note (optional)
                    </label>
                    <textarea
                        id={`resolve-${e.id}`}
                        value={note}
                        onChange={(ev) => setNote(ev.target.value)}
                        maxLength={500}
                        rows={2}
                        className="mt-1 block w-full rounded-control border border-stone-300 bg-white px-3 py-2 text-base"
                    />
                    <Button
                        variant="secondary"
                        className="mt-2"
                        loading={resolve.isPending}
                        onClick={() => resolve.mutate()}
                    >
                        Mark resolved
                    </Button>
                </div>
            )}
        </div>
    );
}

export function EmergencyInbox() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState('open');
    const [openId, setOpenId] = useState<number | null>(null);
    const list = useQuery({
        queryKey: ['emergencies', filter],
        queryFn: () => listEmergencies(filter),
        refetchInterval: 15_000,
    });
    const changed = () => {
        void queryClient.invalidateQueries({ queryKey: ['emergencies'] });
        void queryClient.invalidateQueries({ queryKey: ['emergency'] });
    };

    return (
        <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Emergencies</h1>
            <p className="mt-1 text-base text-stone-600">
                Reports sent by people on duty. Open one to see where it came from.
            </p>

            <div className="mt-4 flex gap-2" role="group" aria-label="Show">
                {[
                    ['open', 'Open'],
                    ['', 'All'],
                ].map(([value, label]) => (
                    <Button
                        key={label}
                        variant={filter === value ? 'primary' : 'secondary'}
                        onClick={() => setFilter(value ?? '')}
                    >
                        {label}
                    </Button>
                ))}
            </div>

            {list.isPending && <p className="mt-4 text-stone-600">Loading...</p>}
            {list.isError && (
                <div className="mt-4">
                    <Alert tone="error">
                        Emergencies did not load. Check your connection and try again.
                    </Alert>
                </div>
            )}
            {list.data?.length === 0 && <p className="mt-4 text-stone-600">No emergencies here.</p>}

            <ul className="mt-4 space-y-3">
                {list.data?.map((e) => (
                    <li key={e.id} className="rounded-card bg-white p-4 ring-1 ring-stone-200">
                        <button
                            type="button"
                            className="block w-full text-left"
                            aria-expanded={openId === e.id}
                            onClick={() => setOpenId(openId === e.id ? null : e.id)}
                        >
                            <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-stone-900 capitalize">
                                    {e.type} · {e.reporter ?? 'Unknown'}
                                </span>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${e.status === 'resolved' ? 'bg-stone-50 text-stone-700 ring-stone-200' : e.status === 'sent' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-amber-50 text-amber-900 ring-amber-200'}`}
                                >
                                    {stateLabel(e)}
                                </span>
                            </span>
                            <span className="mt-0.5 block text-sm text-stone-600">
                                {e.event.title ?? 'Event'} · sent{' '}
                                {stamp.format(new Date(e.sent_at))}
                            </span>
                        </button>
                        {openId === e.id && <Detail id={e.id} onChanged={changed} />}
                    </li>
                ))}
            </ul>
        </div>
    );
}

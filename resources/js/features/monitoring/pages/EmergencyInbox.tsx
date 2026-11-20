// Emergency inbox for the people who review emergencies: the two global reviewer marshals (on their
// phone) and admins (on desktop). One page for both. Opening a report loads its place, and the
// server audits that.
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
import { StatusChip, TypeIcon, type ChipKey } from '../components/emergencyUi';

const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function chipFor(e: ReviewEmergency): { kind: ChipKey; label: string } {
    if (e.status === 'resolved') return { kind: 'resolved', label: 'Resolved' };
    if (e.status === 'acknowledged') return { kind: 'acknowledged', label: 'Acknowledged' };
    return e.escalated ? { kind: 'escalated', label: 'Escalated' } : { kind: 'new', label: 'New' };
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
        <div className="mt-4 space-y-4 border-t border-stone-200 pt-4 text-sm">
            {e.note && (
                <p className="rounded-control bg-stone-50 p-3 text-base whitespace-pre-wrap text-stone-900">
                    {e.note}
                </p>
            )}
            {loc ? (
                <p className="text-stone-700">
                    Place from their last ping (
                    {loc.captured_at ? stamp.format(new Date(loc.captured_at)) : 'time unknown'}
                    {loc.accuracy_m ? `, within ${loc.accuracy_m} m` : ''}):{' '}
                    <a
                        className="inline-flex min-h-10 items-center font-semibold text-maroon-700 underline"
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
                <Button block loading={ack.isPending} onClick={() => ack.mutate()}>
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
                        className="mt-1.5 block w-full rounded-control border border-stone-300 bg-white px-3.5 py-3 text-base text-stone-900 focus:border-maroon-700 focus:outline-none"
                    />
                    <Button
                        variant="secondary"
                        block
                        className="mt-2 sm:w-auto"
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

    const rows = list.data ?? [];
    const waiting = rows.filter((e) => e.status === 'sent').length;

    return (
        <div className="mx-auto max-w-3xl">
            <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                Emergencies
            </h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                Reports sent by people on duty. Open one to see where it came from.
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
                <div
                    className="inline-flex rounded-control border border-stone-300 bg-white p-0.5"
                    role="group"
                    aria-label="Show"
                >
                    {[
                        ['open', 'Open'],
                        ['', 'All'],
                    ].map(([value, label]) => (
                        <button
                            key={label}
                            type="button"
                            aria-pressed={filter === value}
                            onClick={() => setFilter(value ?? '')}
                            className={`min-h-10 min-w-20 rounded-[6px] px-4 text-sm font-semibold ${filter === value ? 'bg-maroon-700 text-white' : 'text-stone-700 hover:bg-stone-50'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {filter === 'open' && waiting > 0 && (
                    <p className="text-sm font-semibold text-red-800 tabular-nums">
                        {waiting} not acknowledged
                    </p>
                )}
            </div>

            {list.isPending && <p className="mt-6 text-stone-600">Loading...</p>}
            {list.isError && (
                <div className="mt-6">
                    <Alert tone="error">
                        Emergencies did not load. Check your connection and try again.
                    </Alert>
                </div>
            )}
            {list.data?.length === 0 && (
                <div className="mt-6 rounded-card bg-white p-8 text-center ring-1 ring-stone-200">
                    <p className="font-semibold text-stone-900">
                        {filter === 'open' ? 'No open emergencies' : 'No emergencies yet'}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                        New reports show up here by themselves.
                    </p>
                </div>
            )}

            <ul className="mt-4 space-y-3">
                {rows.map((e) => {
                    const chip = chipFor(e);
                    const live = e.status !== 'resolved';
                    return (
                        <li
                            key={e.id}
                            className={`rounded-card bg-white p-4 ring-1 sm:p-5 ${chip.kind === 'escalated' ? 'border-l-4 border-red-700 ring-red-200' : live ? 'ring-stone-300' : 'ring-stone-200'}`}
                        >
                            <button
                                type="button"
                                className="flex w-full items-start gap-3 text-left"
                                aria-expanded={openId === e.id}
                                onClick={() => setOpenId(openId === e.id ? null : e.id)}
                            >
                                <span
                                    className={`flex size-11 shrink-0 items-center justify-center rounded-control ring-1 ${live ? 'text-red-700 ring-red-200' : 'text-stone-500 ring-stone-200'}`}
                                >
                                    <TypeIcon type={e.type} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                        <span className="font-semibold text-stone-900">
                                            <span className="capitalize">{e.type}</span> ·{' '}
                                            {e.reporter ?? 'Unknown'}
                                        </span>
                                        <StatusChip kind={chip.kind} label={chip.label} />
                                    </span>
                                    <span className="mt-0.5 block text-sm text-stone-600 tabular-nums">
                                        {e.event.title ?? 'Event'} · sent{' '}
                                        {stamp.format(new Date(e.sent_at))}
                                    </span>
                                </span>
                            </button>
                            {openId === e.id && <Detail id={e.id} onChanged={changed} />}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

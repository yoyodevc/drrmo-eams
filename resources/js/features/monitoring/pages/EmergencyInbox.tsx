// Emergency inbox for the people who review emergencies: the two global reviewer marshals (on their
// phone, /me/emergencies) and admins (the Emergencies tab of Reports). One component for both.
// Opening a report loads its place, and the server audits that.
// From 1024 px inside Reports the list and the open report sit side by side; otherwise a report
// opens under its row. `?open=<id>` opens one, so Needs attention can link straight to it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
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
import { useMediaQuery } from '../hooks/useMediaQuery';

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

// What happened so far, oldest first.
function Timeline({ e }: { e: ReviewEmergency }) {
    const steps = [
        { label: 'Sent', at: e.sent_at, by: e.reporter },
        e.acknowledged_at && {
            label: 'Acknowledged',
            at: e.acknowledged_at,
            by: e.acknowledged_by,
        },
        e.resolved_at && {
            label: 'Resolved',
            at: e.resolved_at,
            by: e.resolved_by,
        },
    ].filter(Boolean) as { label: string; at: string; by: string | null }[];

    return (
        <ol className="space-y-2 border-l-2 border-stone-200 pl-4">
            {steps.map((s) => (
                <li key={s.label} className="relative">
                    <span
                        aria-hidden="true"
                        className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-stone-400 ring-2 ring-white"
                    />
                    <p className="text-stone-900">
                        <span className="font-semibold">{s.label}</span>
                        {s.by ? ` by ${s.by}` : ''}
                    </p>
                    <p className="text-stone-600 tabular-nums">{stamp.format(new Date(s.at))}</p>
                </li>
            ))}
        </ol>
    );
}

function Detail({
    id,
    onChanged,
    panel = false,
}: {
    id: number;
    onChanged: () => void;
    panel?: boolean;
}) {
    const detail = useQuery({
        queryKey: ['emergency', id],
        queryFn: () => getEmergency(id),
        staleTime: 0,
        gcTime: 0,
    });
    const [note, setNote] = useState('');
    const ack = useMutation({
        mutationFn: () => acknowledgeEmergency(id),
        onSuccess: onChanged,
    });
    const resolve = useMutation({
        mutationFn: () => resolveEmergency(id, note.trim()),
        onSuccess: onChanged,
    });

    if (detail.isPending)
        return (
            <div
                aria-hidden="true"
                className={`${panel ? '' : 'mt-4'} h-40 animate-pulse rounded-card bg-stone-100`}
            />
        );
    if (detail.isError)
        return (
            <div className="mt-3">
                <Alert tone="error">This emergency did not load.</Alert>
            </div>
        );
    const e = detail.data;
    const loc = e.location;
    const failed = ack.error ?? resolve.error;
    const chip = chipFor(e);

    return (
        <div className={`space-y-5 text-sm ${panel ? '' : 'mt-4 border-t border-stone-200 pt-4'}`}>
            {panel && (
                <header className="flex items-start gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-control text-red-700 ring-1 ring-red-200">
                        <TypeIcon type={e.type} className="size-7" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 className="text-lg font-semibold text-stone-900">
                                <span className="capitalize">{e.type}</span> emergency
                            </h2>
                            <StatusChip kind={chip.kind} label={chip.label} />
                        </div>
                        <p className="text-stone-600">
                            {e.reporter ?? 'Unknown'} · {e.event.title ?? 'Event'}
                        </p>
                    </div>
                </header>
            )}

            {e.note ? (
                <p className="rounded-control bg-stone-50 p-3 text-base text-pretty whitespace-pre-wrap text-stone-900">
                    {e.note}
                </p>
            ) : (
                <p className="text-stone-500">No note was sent.</p>
            )}

            <div>
                <h3 className="text-xs font-semibold tracking-[0.14em] text-stone-600 uppercase">
                    Place
                </h3>
                {loc ? (
                    <p className="mt-1 text-stone-700">
                        From their last ping,{' '}
                        {loc.captured_at ? stamp.format(new Date(loc.captured_at)) : 'time unknown'}
                        {loc.accuracy_m ? `, within ${loc.accuracy_m} m` : ''}.
                        <a
                            className="mt-1 flex min-h-10 w-fit items-center font-semibold text-maroon-700 underline"
                            href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=18/${loc.lat}/${loc.lng}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open the map
                        </a>
                    </p>
                ) : (
                    <p className="mt-1 text-stone-600">
                        No location was available for this report.
                    </p>
                )}
            </div>

            {e.has_photo && (
                <img
                    src={emergencyPhotoUrl(e.id)}
                    alt="Photo sent with the emergency"
                    className="max-h-80 max-w-full rounded-control object-contain ring-1 ring-stone-200"
                />
            )}

            <div>
                <h3 className="text-xs font-semibold tracking-[0.14em] text-stone-600 uppercase">
                    History
                </h3>
                <div className="mt-2">
                    <Timeline e={e} />
                </div>
                {e.resolution_note && (
                    <p className="mt-2 text-stone-700">Note: {e.resolution_note}</p>
                )}
            </div>

            {failed && <Alert tone="error">{failed.message}</Alert>}

            {e.status === 'sent' && (
                <Button block loading={ack.isPending} onClick={() => ack.mutate()}>
                    {ack.isPending ? 'Acknowledging...' : 'Acknowledge'}
                </Button>
            )}
            {e.status !== 'resolved' && (
                <div className="rounded-control bg-stone-50 p-3 ring-1 ring-stone-200">
                    <label htmlFor={`resolve-${e.id}`} className="block font-medium text-stone-800">
                        Resolution note (optional)
                    </label>
                    <textarea
                        id={`resolve-${e.id}`}
                        value={note}
                        onChange={(ev) => setNote(ev.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="For example: Taken to the clinic."
                        className="mt-1.5 block w-full rounded-control border border-stone-300 bg-white px-3.5 py-3 text-base text-stone-900 focus:border-maroon-700 focus:outline-none"
                    />
                    <Button
                        variant="secondary"
                        block
                        className="mt-2"
                        loading={resolve.isPending}
                        onClick={() => resolve.mutate()}
                    >
                        {resolve.isPending ? 'Saving...' : 'Mark resolved'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function Row({
    e,
    selected,
    onSelect,
}: {
    e: ReviewEmergency;
    selected: boolean;
    onSelect: () => void;
}) {
    const chip = chipFor(e);
    const live = e.status === 'sent';
    return (
        <button
            type="button"
            className="flex w-full items-start gap-3 text-left"
            aria-expanded={selected}
            onClick={onSelect}
        >
            <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-control ring-1 ${live ? 'text-red-700 ring-red-200' : 'text-stone-500 ring-stone-200'}`}
            >
                <TypeIcon type={e.type} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="font-semibold text-stone-900">
                        <span className="capitalize">{e.type}</span> · {e.reporter ?? 'Unknown'}
                    </span>
                    <StatusChip kind={chip.kind} label={chip.label} />
                </span>
                <span className="mt-0.5 block text-sm text-stone-600 tabular-nums">
                    {e.event.title ?? 'Event'} · sent {stamp.format(new Date(e.sent_at))}
                </span>
            </span>
        </button>
    );
}

export function EmergencyInbox({ embedded = false }: { embedded?: boolean }) {
    const queryClient = useQueryClient();
    const [params, setParams] = useSearchParams();
    const wide = useMediaQuery('(min-width: 1024px)');
    const split = embedded && wide;
    const [filter, setFilter] = useState('open');
    const openParam = Number(params.get('open')) || null;
    const [openId, setOpenIdState] = useState<number | null>(openParam);
    const setOpenId = (id: number | null) => {
        setOpenIdState(id);
        if (params.has('open')) {
            const next = new URLSearchParams(params);
            next.delete('open');
            setParams(next, { replace: true });
        }
    };
    const list = useQuery({
        queryKey: ['emergencies', filter],
        queryFn: () => listEmergencies(filter),
        refetchInterval: 15_000,
    });
    const changed = () => {
        void queryClient.invalidateQueries({ queryKey: ['emergencies'] });
        void queryClient.invalidateQueries({ queryKey: ['emergency'] });
        void queryClient.invalidateQueries({ queryKey: ['attention'] });
    };

    const rows = list.data ?? [];
    const waiting = rows.filter((e) => e.status === 'sent').length;
    // Nothing opens by itself: opening one loads the place, and that is audited.
    const shown = openId;

    const toolbar = (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div
                className="inline-flex rounded-control bg-stone-100 p-1"
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
                        onClick={() => {
                            setFilter(value ?? '');
                            setOpenId(null);
                        }}
                        className={`min-h-10 min-w-20 rounded-[6px] px-4 text-sm font-semibold transition-colors ${filter === value ? 'bg-white text-stone-900 ring-1 ring-stone-200' : 'text-stone-600 hover:text-stone-900'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {waiting > 0 && (
                <p className="text-sm font-semibold text-red-800 tabular-nums">
                    {waiting} not acknowledged
                </p>
            )}
        </div>
    );

    const states = (
        <>
            {list.isPending && (
                <div aria-hidden="true" className="mt-4 space-y-3">
                    <div className="h-20 animate-pulse rounded-card bg-stone-200" />
                    <div className="h-20 animate-pulse rounded-card bg-stone-200" />
                </div>
            )}
            {list.isError && (
                <div className="mt-4">
                    <Alert tone="error">
                        Emergencies did not load. Check your connection and try again.
                    </Alert>
                </div>
            )}
            {list.data?.length === 0 && (
                <div className="mt-4 rounded-card bg-white p-8 text-center ring-1 ring-stone-200">
                    <p className="font-semibold text-stone-900">
                        {filter === 'open' ? 'No open emergencies' : 'No emergencies yet'}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                        New reports show up here by themselves.
                    </p>
                </div>
            )}
        </>
    );

    if (split) {
        return (
            <div>
                {toolbar}
                {states}
                {rows.length > 0 && (
                    <div className="mt-4 grid grid-cols-[minmax(320px,400px)_1fr] items-start gap-6">
                        <ul className="divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                            {rows.map((e) => (
                                <li
                                    key={e.id}
                                    className={`relative p-4 ${shown === e.id ? 'bg-maroon-50 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-maroon-700' : 'hover:bg-stone-50'}`}
                                >
                                    <Row
                                        e={e}
                                        selected={shown === e.id}
                                        onSelect={() => setOpenId(e.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                        <section
                            aria-label="Open emergency"
                            className="sticky top-6 rounded-card bg-white p-6 ring-1 ring-stone-200"
                        >
                            {shown !== null ? (
                                <Detail key={shown} id={shown} onChanged={changed} panel />
                            ) : (
                                <div className="py-12 text-center">
                                    <p className="font-semibold text-stone-900">
                                        Pick an emergency
                                    </p>
                                    <p className="mt-1 text-sm text-stone-600">
                                        Its note, place and photo show here. Opening one is
                                        recorded, because it shows where the person was.
                                    </p>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={embedded ? '' : 'mx-auto max-w-3xl'}>
            {!embedded && (
                <>
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Emergencies
                    </h1>
                    <p className="mt-1 mb-5 text-base text-pretty text-stone-600">
                        Reports sent by people on duty. Open one to see where it came from.
                    </p>
                </>
            )}
            {toolbar}
            {states}
            <ul className="mt-4 space-y-3">
                {rows.map((e) => (
                    <li
                        key={e.id}
                        className={`rounded-card bg-white p-4 ring-1 sm:p-5 ${chipFor(e).kind === 'escalated' ? 'border-l-4 border-red-700 ring-red-200' : 'ring-stone-200'}`}
                    >
                        <Row
                            e={e}
                            selected={openId === e.id}
                            onSelect={() => setOpenId(openId === e.id ? null : e.id)}
                        />
                        {openId === e.id && <Detail id={e.id} onChanged={changed} />}
                    </li>
                ))}
            </ul>
        </div>
    );
}

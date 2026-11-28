// Emergency inbox for the people who review emergencies: the two global reviewer marshals (on their
// phone, /me/emergencies) and admins (the Emergencies tab of Reports). One component for both.
// Opening a report loads its place, and the server audits that, so nothing ever opens by itself.
// From 1024 px inside Reports the list and the open report sit side by side; otherwise a report
// opens under its row. `?open=<id>` opens one, so Needs attention can link straight to it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import {
    acknowledgeEmergency,
    emergencyPhotoUrl,
    getEmergency,
    listEmergencies,
    resolveEmergency,
    type ReviewEmergency,
} from '../api';
import { StatusChip, TypeIcon, typeTone, type ChipKey } from '../components/emergencyUi';
import {
    ago,
    ExternalIcon,
    InboxIcon,
    PinIcon,
    stamp,
    typeName,
    useNow,
    when,
} from '../components/reportsUi';
import { useMediaQuery } from '../hooks/useMediaQuery';

function chipFor(e: ReviewEmergency): { kind: ChipKey; label: string } {
    if (e.status === 'resolved') return { kind: 'resolved', label: 'Resolved' };
    if (e.status === 'acknowledged') return { kind: 'acknowledged', label: 'Acknowledged' };
    return e.escalated
        ? { kind: 'escalated', label: 'Escalated' }
        : { kind: 'new', label: 'Not acknowledged' };
}

const eyebrow = 'text-xs font-semibold tracking-wide text-stone-500 uppercase';

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className={eyebrow}>{label}</dt>
            <dd className="mt-1 text-stone-900">{children}</dd>
        </div>
    );
}

// What happened so far, oldest first.
function Timeline({ e }: { e: ReviewEmergency }) {
    const steps = [
        { label: 'Sent', at: e.sent_at, by: e.reporter },
        e.escalated_at && { label: 'Escalated', at: e.escalated_at, by: null },
        e.acknowledged_at && {
            label: 'Acknowledged',
            at: e.acknowledged_at,
            by: e.acknowledged_by,
        },
        e.resolved_at && { label: 'Resolved', at: e.resolved_at, by: e.resolved_by },
    ].filter(Boolean) as { label: string; at: string; by: string | null }[];

    return (
        <ol className="space-y-3">
            {steps.map((s, i) => (
                <li key={s.label} className="relative flex gap-3">
                    {i < steps.length - 1 && (
                        <span
                            aria-hidden="true"
                            className="absolute top-4 bottom-[-12px] left-[4px] w-px bg-stone-200"
                        />
                    )}
                    <span
                        aria-hidden="true"
                        className={`relative mt-1.5 size-2.5 shrink-0 rounded-full ${i === steps.length - 1 ? 'bg-maroon-700' : 'bg-stone-300'}`}
                    />
                    <div className="min-w-0">
                        <p className="text-stone-900">
                            <span className="font-semibold">{s.label}</span>
                            {s.by ? ` by ${s.by}` : ''}
                        </p>
                        <p className="text-stone-500 tabular-nums">
                            {stamp.format(new Date(s.at))}
                        </p>
                    </div>
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
    id: string;
    onChanged: () => void;
    panel?: boolean;
}) {
    const now = useNow();
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
            <div aria-hidden="true" className={`${panel ? '' : 'mt-4'} space-y-4`}>
                <div className="h-14 animate-pulse rounded-control bg-stone-100" />
                <div className="h-24 animate-pulse rounded-control bg-stone-100" />
                <div className="h-32 animate-pulse rounded-control bg-stone-100" />
            </div>
        );
    if (detail.isError)
        return (
            <div className={panel ? '' : 'mt-4'}>
                <Alert tone="error">This emergency did not load.</Alert>
            </div>
        );
    const e = detail.data;
    const loc = e.location;
    const chip = chipFor(e);
    const waiting = e.status === 'sent';

    return (
        <div className={`text-sm ${panel ? '' : 'mt-4 border-t border-stone-200 pt-4'}`}>
            {panel && (
                <header className="flex items-start gap-3 border-b border-stone-200 pb-5">
                    <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-control ring-1 ${typeTone(waiting)}`}
                    >
                        <TypeIcon type={e.type} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 className="text-lg font-semibold text-stone-900">
                                {typeName(e.type)} emergency
                            </h2>
                            <StatusChip kind={chip.kind} label={chip.label} />
                        </div>
                        <p className="mt-0.5 text-stone-600 tabular-nums">
                            Sent {ago(e.sent_at, now).toLowerCase()} · {when(e.sent_at, now)}
                        </p>
                    </div>
                </header>
            )}

            <div className={`space-y-5 ${panel ? 'pt-5' : ''}`}>
                {waiting && (
                    <div className="rounded-control bg-red-50/60 p-4 ring-1 ring-red-200">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-pretty text-red-900">
                                <span className="font-semibold">Nobody has taken this on.</span>{' '}
                                Acknowledge it to tell {e.reporter ?? 'the sender'} that help is
                                coming.
                            </p>
                            <Button
                                size="md"
                                className="max-sm:min-h-12 sm:shrink-0"
                                loading={ack.isPending}
                                onClick={() => ack.mutate()}
                            >
                                {ack.isPending ? 'Acknowledging...' : 'Acknowledge'}
                            </Button>
                        </div>
                        {ack.isError && (
                            <div className="mt-3">
                                <Alert tone="error">{ack.error.message}</Alert>
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <p className={eyebrow}>What they said</p>
                    {e.note ? (
                        <p className="mt-1.5 rounded-control bg-stone-50 px-4 py-3 text-base text-pretty whitespace-pre-wrap text-stone-900 ring-1 ring-stone-200">
                            {e.note}
                        </p>
                    ) : (
                        <p className="mt-1.5 text-stone-500">No note was sent.</p>
                    )}
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Fact label="Reported by">{e.reporter ?? 'Unknown'}</Fact>
                    <Fact label="Event">{e.event.title ?? 'Event'}</Fact>
                    <div className="sm:col-span-2">
                        <dt className={eyebrow}>Place</dt>
                        <dd className="mt-1">
                            {loc ? (
                                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-control px-3 py-2.5 ring-1 ring-stone-200">
                                    <p className="flex min-w-0 items-start gap-2 text-stone-700">
                                        <PinIcon className="mt-0.5 size-4 shrink-0 text-stone-500" />
                                        <span>
                                            Their last ping,{' '}
                                            <span className="tabular-nums">
                                                {loc.captured_at
                                                    ? when(loc.captured_at, now)
                                                    : 'time unknown'}
                                            </span>
                                            {loc.accuracy_m ? `, within ${loc.accuracy_m} m` : ''}
                                        </span>
                                    </p>
                                    <a
                                        className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-maroon-700 underline-offset-2 hover:underline"
                                        href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=18/${loc.lat}/${loc.lng}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Open the map
                                        <ExternalIcon className="size-4" />
                                        <span className="sr-only"> (opens a new tab)</span>
                                    </a>
                                </div>
                            ) : (
                                <span className="text-stone-600">
                                    No location was available for this report.
                                </span>
                            )}
                        </dd>
                    </div>
                </dl>

                {e.has_photo && (
                    <div>
                        <p className={eyebrow}>Photo</p>
                        <img
                            src={emergencyPhotoUrl(e.id)}
                            alt="Photo sent with the emergency"
                            className="mt-1.5 max-h-80 max-w-full rounded-control object-contain ring-1 ring-stone-200"
                        />
                    </div>
                )}

                <div>
                    <p className={eyebrow}>History</p>
                    <div className="mt-2">
                        <Timeline e={e} />
                    </div>
                    {e.resolution_note && (
                        <p className="mt-3 rounded-control bg-stone-50 px-3 py-2 text-stone-700 ring-1 ring-stone-200">
                            <span className="font-semibold text-stone-900">Resolution note:</span>{' '}
                            {e.resolution_note}
                        </p>
                    )}
                </div>

                {e.status !== 'resolved' && (
                    <div className="space-y-4 border-t border-stone-200 pt-5">
                        {resolve.isError && <Alert tone="error">{resolve.error.message}</Alert>}

                        <div className="rounded-control bg-stone-50 p-4 ring-1 ring-stone-200">
                            <label
                                htmlFor={`resolve-${e.id}`}
                                className="block font-medium text-stone-800"
                            >
                                Resolution note{' '}
                                <span className="font-normal text-stone-500">(optional)</span>
                            </label>
                            <textarea
                                id={`resolve-${e.id}`}
                                value={note}
                                onChange={(ev) => setNote(ev.target.value)}
                                maxLength={500}
                                rows={2}
                                placeholder="For example: Taken to the clinic."
                                className="mt-1.5 block w-full rounded-control border border-stone-300 bg-white px-3.5 py-3 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none"
                            />
                            <Button
                                variant={waiting ? 'secondary' : 'primary'}
                                block
                                className="mt-3"
                                loading={resolve.isPending}
                                onClick={() => resolve.mutate()}
                            >
                                {resolve.isPending ? 'Saving...' : 'Mark resolved'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Row({
    e,
    now,
    selected,
    onSelect,
}: {
    e: ReviewEmergency;
    now: number;
    selected: boolean;
    onSelect: () => void;
}) {
    const chip = chipFor(e);
    const live = e.status === 'sent';
    return (
        <button
            type="button"
            className="flex w-full items-start gap-3 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-600"
            aria-expanded={selected}
            onClick={onSelect}
        >
            <TypeIcon
                type={e.type}
                className={`mt-0.5 size-5 shrink-0 ${live ? 'text-red-700' : 'text-stone-400'}`}
            />
            <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-stone-900">{typeName(e.type)}</span>
                    <span
                        className={`shrink-0 text-sm tabular-nums ${live ? 'font-semibold text-red-800' : 'text-stone-500'}`}
                    >
                        {ago(e.sent_at, now)}
                    </span>
                </span>
                <span className="mt-0.5 block text-sm text-stone-600">
                    {e.reporter ?? 'Unknown'} · {e.event.title ?? 'Event'}
                </span>
                <span className="mt-1.5 block">
                    <StatusChip kind={chip.kind} label={chip.label} />
                </span>
            </span>
        </button>
    );
}

export function EmergencyInbox({ embedded = false }: { embedded?: boolean }) {
    const queryClient = useQueryClient();
    const now = useNow();
    const [params, setParams] = useSearchParams();
    const wide = useMediaQuery('(min-width: 1024px)');
    const split = embedded && wide;
    const [filter, setFilter] = useState<'open' | 'all'>('open');
    const openParam = params.get('open') || null;
    const [openId, setOpenIdState] = useState<string | null>(openParam);
    const setOpenId = (id: string | null) => {
        setOpenIdState(id);
        if (params.has('open')) {
            const next = new URLSearchParams(params);
            next.delete('open');
            setParams(next, { replace: true });
        }
    };
    const list = useQuery({
        queryKey: ['emergencies', filter],
        queryFn: () => listEmergencies(filter === 'all' ? '' : filter),
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
            <SegmentedControl
                label="Show"
                value={filter}
                onChange={(value) => {
                    setFilter(value);
                    setOpenId(null);
                }}
                options={[
                    {
                        id: 'open',
                        label: 'Open',
                        count: filter === 'open' ? list.data?.length : undefined,
                    },
                    { id: 'all', label: 'All' },
                ]}
            />
            {waiting > 0 && (
                <p
                    role="status"
                    className="flex items-center gap-2 text-sm font-semibold text-red-800 tabular-nums"
                >
                    <span aria-hidden="true" className="size-2 rounded-full bg-red-700" />
                    {waiting} not acknowledged
                </p>
            )}
        </div>
    );

    const states = (
        <>
            {list.isPending && (
                <div aria-hidden="true" className="mt-4 space-y-3">
                    <div className="h-24 animate-pulse rounded-card bg-stone-200" />
                    <div className="h-24 animate-pulse rounded-card bg-stone-200" />
                </div>
            )}
            {list.isError && (
                <div className="mt-4 max-w-xl space-y-3">
                    <Alert tone="error">
                        Emergencies did not load. Check your connection and try again.
                    </Alert>
                    <Button variant="secondary" size="md" onClick={() => void list.refetch()}>
                        Retry
                    </Button>
                </div>
            )}
            {list.data?.length === 0 && (
                <div className="mt-4 flex flex-col items-center rounded-card bg-white px-6 py-12 text-center ring-1 ring-stone-200">
                    <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-green-700">
                        <InboxIcon className="size-6" />
                    </span>
                    <p className="mt-4 font-semibold text-stone-900">
                        {filter === 'open' ? 'No open emergencies' : 'No emergencies yet'}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-pretty text-stone-600">
                        New ones show up here by themselves. This list checks again every 15
                        seconds.
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
                    <div className="mt-4 grid grid-cols-[minmax(300px,380px)_1fr] items-start gap-6">
                        <ul
                            aria-label="Emergencies"
                            className="divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
                        >
                            {rows.map((e) => (
                                <li
                                    key={e.id}
                                    className={`relative p-4 transition-colors ${shown === e.id ? 'bg-maroon-50 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-maroon-700' : `hover:bg-stone-50 ${e.status === 'sent' ? 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-red-700' : ''}`}`}
                                >
                                    <Row
                                        e={e}
                                        now={now}
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
                                <div className="flex flex-col items-center py-16 text-center">
                                    <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-stone-500">
                                        <PinIcon className="size-6" />
                                    </span>
                                    <p className="mt-4 font-semibold text-stone-900">
                                        Pick an emergency to open it
                                    </p>
                                    <p className="mt-1 max-w-xs text-sm text-pretty text-stone-600">
                                        You will see the note, the place and the photo. Opening one
                                        is recorded, because it shows where the person was.
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
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                        Emergencies
                    </h1>
                    <p className="mt-1 mb-5 text-base text-pretty text-stone-600">
                        Sent by people on duty. Open one to see where it came from.
                    </p>
                </>
            )}
            {toolbar}
            {states}
            {rows.length > 0 && (
                <ul
                    aria-label="Emergencies"
                    className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
                >
                    {rows.map((e) => (
                        <li
                            key={e.id}
                            className={`relative px-4 py-3.5 sm:px-5 ${e.status === 'sent' ? 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-red-700' : ''}`}
                        >
                            <Row
                                e={e}
                                now={now}
                                selected={openId === e.id}
                                onSelect={() => setOpenId(openId === e.id ? null : e.id)}
                            />
                            {openId === e.id && <Detail id={e.id} onChanged={changed} />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

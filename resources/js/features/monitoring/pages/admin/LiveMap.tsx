// A-Live map (S4.3) and ping trail (S4.4). Desktop first. Latest pin per on-duty person, grey after
// 5 minutes. Polls every 30 seconds. Click a person to draw their trail for this shift.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, type ReactNode } from 'react';
import { CircleMarker, MapContainer, Polyline, Tooltip, useMap } from 'react-leaflet';
import { Alert } from '@/shared/ui/Alert';
import { getLatestMap, getTrail, type MapPerson } from '../../api';
import { CampusMapLayers, HomeIcon } from '../../components/CampusMapLayers';
import {
    eventOptions,
    lastSeen,
    MAP_HOME,
    MAP_HOME_ZOOM,
    matchesSearch,
    pinColors,
    POLL_MS,
    splitPeople,
} from '../../mapView';

const control =
    'h-10 rounded-control border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-maroon-700 focus:outline-none';

// Selected trail and ring: ember-500 on a white casing, maroon-700 ring.
const TRAIL = '#f04e12';
const SELECTED_RING = '#7d1d23';

function clock(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Zooms the map to the chosen person or their trail. Runs when the choice or the trail changes,
// not on every 30 second refresh, so it never fights with a person panning the map.
function FitTo({ points }: { points: [number, number][] }) {
    const map = useMap();
    const key = points.map((p) => p.join(',')).join(';');
    useEffect(() => {
        if (points.length === 0) return;
        map.flyToBounds(L.latLngBounds(points), { maxZoom: 18, padding: [60, 60], duration: 0.4 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, key]);
    return null;
}

function StateDot({ state }: { state: MapPerson['state'] }) {
    if (state === 'live') {
        return <span className="size-2.5 shrink-0 rounded-full bg-ember-500" aria-hidden="true" />;
    }
    if (state === 'stale') {
        return <span className="size-2.5 shrink-0 rounded-full bg-stone-500" aria-hidden="true" />;
    }
    return (
        <span
            className="size-2.5 shrink-0 rounded-full border-2 border-dashed border-stone-400"
            aria-hidden="true"
        />
    );
}

function PersonRow({
    person,
    now,
    selected,
    onSelect,
}: {
    person: MapPerson;
    now: number;
    selected: boolean;
    onSelect: () => void;
}) {
    const body = (
        <>
            <StateDot state={person.state} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-stone-900">
                    {person.name}
                </span>
                <span className="block truncate text-xs text-stone-500">
                    {person.event_title ?? `Event ${person.event_id}`}
                </span>
            </span>
            <span className="shrink-0 text-xs text-stone-600 tabular-nums">
                {person.ping ? lastSeen(person.ping.captured_at, now) : 'Not yet'}
            </span>
        </>
    );

    // Nobody with no location can be shown on the map, so their row is plain text.
    if (!person.ping) {
        return <li className="flex items-center gap-3 px-4 py-2.5">{body}</li>;
    }

    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                className={`relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected ? 'bg-maroon-50 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-maroon-700' : 'hover:bg-stone-50'}`}
            >
                {body}
            </button>
        </li>
    );
}

function Section({
    title,
    hint,
    people,
    children,
}: {
    title: string;
    hint: string;
    people: MapPerson[];
    children: ReactNode;
}) {
    return (
        <section>
            <h2 className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-y border-stone-100 bg-stone-50/95 px-4 py-2 backdrop-blur">
                <span className="text-xs font-semibold tracking-wide text-stone-600 uppercase">
                    {title}
                </span>
                <span className="text-xs text-stone-500 tabular-nums">{people.length}</span>
            </h2>
            {people.length === 0 ? (
                <p className="px-4 py-3 text-sm text-stone-500">{hint}</p>
            ) : (
                <ul className="divide-y divide-stone-100">{children}</ul>
            )}
        </section>
    );
}

function ListSkeleton() {
    return (
        <div className="space-y-4 p-4" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                    <div className="size-2.5 animate-pulse rounded-full bg-stone-200" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-2/3 animate-pulse rounded bg-stone-200" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-stone-200" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function Legend({ showTrail }: { showTrail: boolean }) {
    const item = 'flex items-center gap-2';
    return (
        <div className="pointer-events-none absolute bottom-6 left-3 z-[1000] rounded-control bg-white/95 px-3 py-2 text-xs text-stone-700 shadow-raised ring-1 ring-stone-200">
            <ul className="space-y-1.5">
                <li className={item}>
                    <span className="size-2.5 rounded-full bg-ember-500" />
                    Sharing now
                </li>
                <li className={item}>
                    <span className="size-2.5 rounded-full bg-stone-500" />
                    No ping 5+ min
                </li>
                <li className={item}>
                    <span className="h-0.5 w-4 rounded-full bg-maroon-700" />
                    Campus border
                </li>
                {showTrail && (
                    <li className={item}>
                        <span className="h-1 w-4 rounded-full bg-ember-500" />
                        Trail this shift
                    </li>
                )}
            </ul>
        </div>
    );
}

function CloseIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M6 6l12 12M18 6L6 18" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
        </svg>
    );
}

// The person picked on the map or in the list, with their trail and what to do next.
function SelectedCard({
    person,
    now,
    trailCount,
    trailFailed,
    trailLoading,
    onZoom,
    onClear,
}: {
    person: MapPerson;
    now: number;
    trailCount: number | null;
    trailFailed: boolean;
    trailLoading: boolean;
    onZoom: () => void;
    onClear: () => void;
}) {
    const ping = person.ping;
    return (
        <div className="border-b border-stone-200 bg-white p-4">
            <div className="flex items-start gap-3">
                <span className="mt-1.5">
                    <StateDot state={person.state} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-stone-900">{person.name}</p>
                    <p className="truncate text-sm text-stone-600">
                        {person.event_title ?? `Event ${person.event_id}`}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear selection"
                    className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-control text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
                >
                    <CloseIcon />
                </button>
            </div>
            {ping && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                        <dt className="text-xs text-stone-500">Last seen</dt>
                        <dd className="text-stone-900">
                            {lastSeen(ping.captured_at, now)}{' '}
                            <span className="text-stone-500">at {clock(ping.captured_at)}</span>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-stone-500">Accuracy</dt>
                        <dd className="text-stone-900 tabular-nums">
                            {ping.accuracy_m !== null
                                ? `About ${Math.round(ping.accuracy_m)} m`
                                : 'Unknown'}
                        </dd>
                    </div>
                    <div className="col-span-2">
                        <dt className="text-xs text-stone-500">Trail this shift</dt>
                        <dd className="text-stone-900">
                            {trailFailed
                                ? 'Could not load the trail.'
                                : trailLoading || trailCount === null
                                  ? 'Loading...'
                                  : trailCount === 1
                                    ? '1 point'
                                    : `${trailCount} points`}
                        </dd>
                    </div>
                </dl>
            )}
            <button
                type="button"
                onClick={onZoom}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-control border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50"
            >
                <SearchIcon />
                Zoom to {person.name.split(' ')[0]}
            </button>
        </div>
    );
}

export function LiveMap() {
    const [eventId, setEventId] = useState<number | undefined>();
    const [selected, setSelected] = useState<number | null>(null);
    const [query, setQuery] = useState('');
    const [map, setMap] = useState<L.Map | null>(null);

    const latest = useQuery({
        queryKey: ['map-latest', eventId ?? null],
        queryFn: () => getLatestMap(eventId),
        refetchInterval: POLL_MS,
        placeholderData: keepPreviousData,
        // Every load is audited, so reloading when the tab regains focus would add rows for nothing.
        refetchOnWindowFocus: false,
    });
    // The trail loads once per click, not on a timer, so one click is one audit row.
    const trail = useQuery({
        queryKey: ['map-trail', selected],
        queryFn: () => getTrail(selected as number),
        enabled: selected !== null,
        staleTime: Infinity,
    });

    // Times are read against the server's clock from the same response, so they match the data.
    const now = latest.data ? Date.parse(latest.data.generated_at) : 0;
    const people = latest.data?.people ?? [];
    const { onMap, live, stale, none } = splitPeople(people);
    const options = eventOptions(people);
    const chosen = onMap.find((p) => p.assignment_id === selected) ?? null;
    const trailPoints: [number, number][] = (trail.data ?? []).map((p) => [p.lat, p.lng]);
    const focus: [number, number][] =
        trailPoints.length > 0
            ? trailPoints
            : chosen?.ping
              ? [[chosen.ping.lat, chosen.ping.lng]]
              : [];
    const toggle = (id: number) => setSelected((cur) => (cur === id ? null : id));
    const shown = (list: MapPerson[]) => list.filter((p) => matchesSearch(p, query));
    const loading = latest.isPending;

    const goHome = () => map?.flyTo(MAP_HOME, MAP_HOME_ZOOM, { duration: 0.4 });
    const zoomToChosen = () => {
        if (!map || focus.length === 0) return;
        map.flyToBounds(L.latLngBounds(focus), { maxZoom: 18, padding: [60, 60], duration: 0.4 });
    };

    const row = (p: MapPerson) => (
        <PersonRow
            key={p.assignment_id}
            person={p}
            now={now}
            selected={selected === p.assignment_id}
            onSelect={() => toggle(p.assignment_id)}
        />
    );

    return (
        <div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
                <div className="min-w-0 lg:flex-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                        Live map
                    </h1>
                    {loading ? (
                        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-stone-200" />
                    ) : (
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-stone-600">
                            <span className="relative flex size-2" aria-hidden="true">
                                {live.length > 0 && (
                                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember-500 opacity-60" />
                                )}
                                <span
                                    className={`relative inline-flex size-2 rounded-full ${live.length > 0 ? 'bg-ember-500' : 'bg-stone-400'}`}
                                />
                            </span>
                            <span>
                                <strong className="font-semibold text-stone-900 tabular-nums">
                                    {live.length}
                                </strong>{' '}
                                of <span className="tabular-nums">{people.length}</span> on duty
                                sharing now.
                            </span>
                            {latest.data && (
                                <span className="text-stone-500">
                                    Updated {clock(latest.data.generated_at)}, refreshes every 30
                                    seconds.
                                </span>
                            )}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-sm font-medium text-stone-800">
                        Find a person
                        <span className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-stone-500">
                                <SearchIcon />
                            </span>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Name or event"
                                className={`${control} w-52 pl-9`}
                            />
                        </span>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-stone-800">
                        Event
                        <select
                            className={`${control} w-52`}
                            value={eventId ?? ''}
                            onChange={(e) => {
                                setEventId(e.target.value ? Number(e.target.value) : undefined);
                                setSelected(null);
                            }}
                        >
                            <option value="">All events</option>
                            {options.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.title}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {latest.isError && (
                <div className="mt-4">
                    <Alert tone="error">Could not load the map. It will try again shortly.</Alert>
                </div>
            )}

            <div className="mt-6 grid gap-6 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="eams-map relative h-[28rem] overflow-hidden rounded-card bg-stone-200 ring-1 ring-stone-200 lg:h-full">
                    <MapContainer
                        ref={setMap}
                        center={MAP_HOME}
                        zoom={MAP_HOME_ZOOM}
                        className="h-full w-full"
                    >
                        <CampusMapLayers />
                        <FitTo points={focus} />
                        {trailPoints.length > 1 && (
                            <>
                                <Polyline
                                    positions={trailPoints}
                                    pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.9 }}
                                    interactive={false}
                                />
                                <Polyline
                                    positions={trailPoints}
                                    pathOptions={{ color: TRAIL, weight: 4 }}
                                    interactive={false}
                                />
                                <CircleMarker
                                    center={trailPoints[0]}
                                    radius={5}
                                    pathOptions={{
                                        color: TRAIL,
                                        weight: 2,
                                        fillColor: '#ffffff',
                                        fillOpacity: 1,
                                    }}
                                >
                                    <Tooltip direction="top" offset={[0, -6]} className="eams-tip">
                                        Start of trail
                                        {trail.data?.[0] && `, ${clock(trail.data[0].captured_at)}`}
                                    </Tooltip>
                                </CircleMarker>
                            </>
                        )}
                        {onMap.map((p) => {
                            if (!p.ping) return null;
                            const isSelected = selected === p.assignment_id;
                            return (
                                <CircleMarker
                                    key={`${p.assignment_id}-${isSelected}`}
                                    center={[p.ping.lat, p.ping.lng]}
                                    radius={isSelected ? 10 : 7}
                                    pathOptions={{
                                        color: isSelected ? SELECTED_RING : '#ffffff',
                                        weight: isSelected ? 3 : 2,
                                        fillColor: pinColors[p.state],
                                        fillOpacity: 1,
                                    }}
                                    eventHandlers={{ click: () => setSelected(p.assignment_id) }}
                                >
                                    <Tooltip
                                        direction="top"
                                        offset={[0, isSelected ? -10 : -7]}
                                        permanent={isSelected}
                                        className="eams-tip"
                                    >
                                        <span className="font-semibold">{p.name}</span>
                                        <span className="text-stone-500">
                                            {' '}
                                            {lastSeen(p.ping.captured_at, now)}
                                        </span>
                                    </Tooltip>
                                </CircleMarker>
                            );
                        })}
                    </MapContainer>

                    <button
                        type="button"
                        onClick={goHome}
                        className="absolute top-[5.25rem] left-[10px] z-[1000] grid size-[34px] place-items-center rounded-control bg-white text-stone-700 shadow-raised ring-1 ring-stone-300 transition-colors hover:bg-stone-50 hover:text-stone-900"
                        aria-label="Back to campus view"
                        title="Back to campus view"
                    >
                        <HomeIcon />
                    </button>

                    {!loading && onMap.length === 0 && (
                        <div className="pointer-events-none absolute inset-x-0 top-4 z-[1000] flex justify-center px-16">
                            <p className="rounded-control bg-white/95 px-4 py-2 text-sm text-stone-700 shadow-raised ring-1 ring-stone-200">
                                Nobody is sharing a location right now.
                            </p>
                        </div>
                    )}

                    <Legend showTrail={trailPoints.length > 1} />
                </div>

                <aside
                    aria-label="People on duty"
                    className="flex min-h-0 flex-col overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
                >
                    {chosen && (
                        <SelectedCard
                            person={chosen}
                            now={now}
                            trailCount={trail.data ? trail.data.length : null}
                            trailFailed={trail.isError}
                            trailLoading={trail.isFetching}
                            onZoom={zoomToChosen}
                            onClear={() => setSelected(null)}
                        />
                    )}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {loading ? (
                            <ListSkeleton />
                        ) : people.length === 0 ? (
                            <div className="px-6 py-10 text-center">
                                <p className="text-sm font-medium text-stone-900">
                                    Nobody is on duty right now.
                                </p>
                                <p className="mt-1 text-sm text-pretty text-stone-500">
                                    People show up here when they start duty on their phone.
                                </p>
                            </div>
                        ) : (
                            <>
                                <Section
                                    title="Sharing now"
                                    hint={query ? 'No match.' : 'Nobody right now.'}
                                    people={shown(live)}
                                >
                                    {shown(live).map(row)}
                                </Section>
                                <Section
                                    title="No ping 5+ min"
                                    hint={query ? 'No match.' : 'Everyone is up to date.'}
                                    people={shown(stale)}
                                >
                                    {shown(stale).map(row)}
                                </Section>
                                <Section
                                    title="No location yet"
                                    hint={query ? 'No match.' : 'Nobody.'}
                                    people={shown(none)}
                                >
                                    {shown(none).map(row)}
                                </Section>
                            </>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}

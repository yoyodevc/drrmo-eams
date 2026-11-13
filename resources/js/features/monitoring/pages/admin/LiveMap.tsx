// A-Live map (S4.3) and ping trail (S4.4). Desktop first. Latest pin per on-duty person, grey after
// 5 minutes. Polls every 30 seconds. Click a person to draw their trail for this shift.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import {
    CircleMarker,
    LayersControl,
    MapContainer,
    Polyline,
    Popup,
    TileLayer,
} from 'react-leaflet';
import { Alert } from '@/shared/ui/Alert';
import { getLatestMap, getTrail, type MapPerson } from '../../api';
import {
    CAMPUS_CENTER,
    eventOptions,
    lastSeen,
    pinColors,
    POLL_MS,
    splitPeople,
} from '../../mapView';

const control =
    'min-h-10 rounded-control border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-maroon-700 focus:outline-none';

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
    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-stone-50 ${selected ? 'bg-maroon-50' : ''}`}
            >
                <span className="min-w-0">
                    <span className="block truncate font-medium text-stone-900">{person.name}</span>
                    <span className="block truncate text-stone-500">{person.event_title}</span>
                </span>
                <span className="shrink-0 text-xs text-stone-600">
                    {person.ping ? lastSeen(person.ping.captured_at, now) : 'No location'}
                </span>
            </button>
        </li>
    );
}

function Section({
    title,
    people,
    now,
    selected,
    onSelect,
}: {
    title: string;
    people: MapPerson[];
    now: number;
    selected: number | null;
    onSelect: (id: number) => void;
}) {
    return (
        <section className="mt-5 first:mt-0">
            <h2 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                {title} ({people.length})
            </h2>
            {people.length === 0 ? (
                <p className="mt-1 text-sm text-stone-500">Nobody.</p>
            ) : (
                <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                    {people.map((p) => (
                        <PersonRow
                            key={p.assignment_id}
                            person={p}
                            now={now}
                            selected={selected === p.assignment_id}
                            onSelect={() => onSelect(p.assignment_id)}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

export function LiveMap() {
    const [eventId, setEventId] = useState<number | undefined>();
    const [selected, setSelected] = useState<number | null>(null);

    const latest = useQuery({
        queryKey: ['map-latest', eventId ?? null],
        queryFn: () => getLatestMap(eventId),
        refetchInterval: POLL_MS,
        placeholderData: keepPreviousData,
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
    const { onMap, stale, none } = splitPeople(people);
    const liveCount = onMap.filter((p) => p.state === 'live').length;
    const options = eventOptions(people);
    const toggle = (id: number) => setSelected((cur) => (cur === id ? null : id));

    return (
        <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                        Live map
                    </h1>
                    <p className="mt-1 text-stone-600">
                        {liveCount} of {people.length} on duty are sharing now. Updates every 30
                        seconds.
                    </p>
                </div>
                <label className="flex flex-col gap-1 text-sm font-medium text-stone-800">
                    Event
                    <select
                        className={control}
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

            {latest.isError && (
                <div className="mt-4">
                    <Alert tone="error">Could not load the map. It will try again shortly.</Alert>
                </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
                <div className="h-[32rem] overflow-hidden rounded-card ring-1 ring-stone-200">
                    <MapContainer center={CAMPUS_CENTER} zoom={17} className="h-full w-full">
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer checked name="Satellite (Esri)">
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                                    maxZoom={19}
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="Streets (OpenStreetMap)">
                                <TileLayer
                                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution="&copy; OpenStreetMap contributors"
                                    maxZoom={19}
                                />
                            </LayersControl.BaseLayer>
                        </LayersControl>
                        {trail.data && trail.data.length > 1 && (
                            <Polyline
                                positions={trail.data.map((p) => [p.lat, p.lng])}
                                pathOptions={{ color: '#7f1d1d', weight: 4 }}
                            />
                        )}
                        {onMap.map((p) =>
                            p.ping ? (
                                <CircleMarker
                                    key={p.assignment_id}
                                    center={[p.ping.lat, p.ping.lng]}
                                    radius={selected === p.assignment_id ? 11 : 8}
                                    pathOptions={{
                                        color: '#ffffff',
                                        weight: 2,
                                        fillColor: pinColors[p.state],
                                        fillOpacity: 1,
                                    }}
                                    eventHandlers={{ click: () => setSelected(p.assignment_id) }}
                                >
                                    <Popup>
                                        <strong>{p.name}</strong>
                                        <br />
                                        Last seen {lastSeen(p.ping.captured_at, now)}
                                    </Popup>
                                </CircleMarker>
                            ) : null,
                        )}
                    </MapContainer>
                </div>

                <aside>
                    <Section
                        title="On the map"
                        people={onMap}
                        now={now}
                        selected={selected}
                        onSelect={toggle}
                    />
                    <Section
                        title="No ping 5+ min"
                        people={stale}
                        now={now}
                        selected={selected}
                        onSelect={toggle}
                    />
                    <Section
                        title="No location"
                        people={none}
                        now={now}
                        selected={selected}
                        onSelect={toggle}
                    />
                    {selected !== null && trail.isError && (
                        <p className="mt-4 text-sm text-red-800">Could not load the trail.</p>
                    )}
                    {selected !== null && trail.data && (
                        <p className="mt-4 text-sm text-stone-600">
                            Trail: {trail.data.length} points this shift.
                        </p>
                    )}
                </aside>
            </div>
        </div>
    );
}

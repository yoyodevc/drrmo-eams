// Maps for the Locations list on A-Manage lists.
// LocationPicker: click the map or drag the pin to set a place. The typed fields stay as a fallback.
// LocationsOverview: every saved location on one map, click a pin to edit it.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { CampusMapLayers, HomeIcon } from '@/features/monitoring/components/CampusMapLayers';
import {
    formatCoord,
    insideCampus,
    MAP_HOME,
    MAP_HOME_ZOOM,
    parseCoords,
} from '@/features/monitoring/mapView';
import { TextField } from '@/shared/ui/TextField';

// maroon-700 pin on a white edge, from the design tokens.
const PIN_FILL = '#7d1d23';
const MUTED_FILL = '#78716c';

const pinIcon = L.divIcon({
    className: 'eams-pin',
    html: `<svg width="32" height="42" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 40.5S29 28 29 16.5A13 13 0 0 0 3 16.5C3 28 16 40.5 16 40.5z" fill="${PIN_FILL}" stroke="#fff" stroke-width="2.5"/><circle cx="16" cy="16.5" r="5" fill="#fff"/></svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 41],
    tooltipAnchor: [0, -38],
});

const mapButton =
    'grid size-[34px] place-items-center rounded-control bg-white text-stone-700 shadow-raised ring-1 ring-stone-300 transition-colors hover:bg-stone-50 hover:text-stone-900';

// Leaflet measures its box once. Inside a dialog that box grows during the open animation,
// so measure again whenever it changes size.
function KeepSized() {
    const map = useMap();
    useEffect(() => {
        const box = map.getContainer();
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(box);
        return () => observer.disconnect();
    }, [map]);
    return null;
}

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
    useMapEvents({ click: (e) => onPlace(e.latlng.lat, e.latlng.lng) });
    return null;
}

function TargetIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
        </svg>
    );
}

export function LocationPicker({
    latitude,
    longitude,
    onChange,
    errors,
}: {
    latitude: string;
    longitude: string;
    onChange: (latitude: string, longitude: string) => void;
    errors: { latitude?: string; longitude?: string };
}) {
    const [map, setMap] = useState<L.Map | null>(null);
    const point = parseCoords(latitude, longitude);
    // Where the map first opens: on the saved pin, or on the oval for a new place.
    const [start] = useState(() => point);
    const markerRef = useRef<L.Marker | null>(null);

    const place = (lat: number, lng: number) => onChange(formatCoord(lat), formatCoord(lng));
    const outside = point !== null && !insideCampus(point[0], point[1]);

    const dragHandlers = useMemo(
        () => ({
            dragend: () => {
                const at = markerRef.current?.getLatLng();
                if (at) onChange(formatCoord(at.lat), formatCoord(at.lng));
            },
        }),
        [onChange],
    );

    return (
        <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-stone-800">Place on the map</legend>
            <p className="mb-2 text-sm text-pretty text-stone-500">
                Click the map to drop the pin, then drag it to fine tune. You can also type the
                numbers below.
            </p>
            <div className="eams-map eams-pick relative h-64 overflow-hidden rounded-control bg-stone-200 ring-1 ring-stone-300 sm:h-80">
                <MapContainer
                    ref={setMap}
                    center={start ?? MAP_HOME}
                    zoom={start ? 18 : MAP_HOME_ZOOM}
                    className="h-full w-full"
                >
                    <CampusMapLayers />
                    <KeepSized />
                    <ClickToPlace onPlace={place} />
                    {point && (
                        <Marker
                            ref={markerRef}
                            position={point}
                            icon={pinIcon}
                            draggable
                            keyboard={false}
                            eventHandlers={dragHandlers}
                        />
                    )}
                </MapContainer>
                <div className="absolute top-[5.25rem] left-[10px] z-[1000] flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            map?.flyTo(point ?? MAP_HOME, point ? 18 : MAP_HOME_ZOOM, {
                                duration: 0.4,
                            })
                        }
                        className={mapButton}
                        aria-label={point ? 'Go to the pin' : 'Back to campus view'}
                        title={point ? 'Go to the pin' : 'Back to campus view'}
                    >
                        <HomeIcon />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const c = map?.getCenter();
                            if (c) place(c.lat, c.lng);
                        }}
                        className={mapButton}
                        aria-label="Put the pin at the center of the map"
                        title="Put the pin at the center of the map"
                    >
                        <TargetIcon />
                    </button>
                </div>
                {!point && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[1000] flex justify-center px-4">
                        <p className="rounded-control bg-white/95 px-3 py-1.5 text-sm text-stone-700 shadow-raised ring-1 ring-stone-200">
                            Click the map to drop the pin.
                        </p>
                    </div>
                )}
            </div>
            {outside && (
                <p className="mt-2 text-sm text-amber-900">
                    This pin is outside the campus border. Check it is in the right place.
                </p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Latitude"
                    inputMode="decimal"
                    value={latitude}
                    onChange={(e) => onChange(e.target.value, longitude)}
                    error={errors.latitude}
                    hint={`For example, ${MAP_HOME[0]}.`}
                />
                <TextField
                    label="Longitude"
                    inputMode="decimal"
                    value={longitude}
                    onChange={(e) => onChange(latitude, e.target.value)}
                    error={errors.longitude}
                    hint={`For example, ${MAP_HOME[1]}.`}
                />
            </div>
        </fieldset>
    );
}

export interface MapPlace {
    key: string | number;
    name: string;
    active: boolean;
    latitude: number;
    longitude: number;
}

// Flies to the chosen place when the choice changes.
function FlyTo({ point }: { point: [number, number] | null }) {
    const map = useMap();
    const key = point?.join(',') ?? '';
    useEffect(() => {
        if (point) map.flyTo(point, 18, { duration: 0.4 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, key]);
    return null;
}

export function LocationsOverview({
    places,
    focused,
    onOpen,
}: {
    places: MapPlace[];
    focused: string | number | null;
    onOpen: (key: string | number) => void;
}) {
    const [map, setMap] = useState<L.Map | null>(null);
    const target = places.find((p) => p.key === focused) ?? null;
    return (
        <div className="eams-map relative h-72 overflow-hidden bg-stone-200 lg:h-full lg:min-h-[28rem]">
            <MapContainer
                ref={setMap}
                center={MAP_HOME}
                zoom={MAP_HOME_ZOOM}
                className="h-full w-full"
            >
                <CampusMapLayers />
                <KeepSized />
                <FlyTo point={target ? [target.latitude, target.longitude] : null} />
                {places.map((p) => {
                    const isFocused = p.key === focused;
                    return (
                        <CircleMarker
                            key={`${p.key}-${isFocused}`}
                            center={[p.latitude, p.longitude]}
                            radius={isFocused ? 9 : 7}
                            pathOptions={{
                                color: '#ffffff',
                                weight: 2,
                                fillColor: p.active ? PIN_FILL : MUTED_FILL,
                                fillOpacity: 1,
                            }}
                            eventHandlers={{ click: () => onOpen(p.key) }}
                        >
                            <Tooltip
                                direction="top"
                                offset={[0, isFocused ? -9 : -7]}
                                permanent={isFocused}
                                className="eams-tip"
                            >
                                <span className="font-semibold">{p.name}</span>
                                {!p.active && <span className="text-stone-500"> Inactive</span>}
                            </Tooltip>
                        </CircleMarker>
                    );
                })}
            </MapContainer>
            <button
                type="button"
                onClick={() => map?.flyTo(MAP_HOME, MAP_HOME_ZOOM, { duration: 0.4 })}
                className={`absolute top-[5.25rem] left-[10px] z-[1000] ${mapButton}`}
                aria-label="Back to campus view"
                title="Back to campus view"
            >
                <HomeIcon />
            </button>
            <div className="pointer-events-none absolute bottom-6 left-3 z-[1000] rounded-control bg-white/95 px-3 py-2 text-xs text-stone-700 shadow-raised ring-1 ring-stone-200">
                <ul className="space-y-1.5">
                    <li className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-maroon-700" />
                        Active
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-stone-500" />
                        Inactive
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="h-0.5 w-4 rounded-full bg-maroon-700" />
                        Campus border
                    </li>
                </ul>
            </div>
        </div>
    );
}

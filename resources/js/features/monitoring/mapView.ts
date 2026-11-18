// Pure helpers for the live map (S4.3). No React or Leaflet in here so they are easy to test.
import type { MapPerson, MapState } from './api';

// Where the map opens: the ZPPSU Oval, the athletic oval inside the campus. Centroid of
// OpenStreetMap way 1569631012 ("ZPPSU Oval"). At zoom 17 the whole campus fits around it.
export const MAP_HOME: [number, number] = [6.91371, 122.05938];
export const MAP_HOME_ZOOM = 17;

// Campus perimeter from OpenStreetMap relation 3679647 (ODbL, openstreetmap.org/copyright).
// Two rings: the main campus and the strip along Ricardo S. Baban Road. Points are [lat, lng].
export const CAMPUS_BOUNDARY: [number, number][][] = [
    [
        [6.9119743, 122.057778],
        [6.9116988, 122.0577973],
        [6.9117309, 122.0582519],
        [6.9116623, 122.0584019],
        [6.9116903, 122.0584555],
        [6.9117182, 122.0585427],
        [6.9117382, 122.0586821],
        [6.9117635, 122.0589638],
        [6.9117622, 122.0592186],
        [6.9117449, 122.0593514],
        [6.9117236, 122.059464],
        [6.9116996, 122.0595673],
        [6.9116557, 122.0597161],
        [6.9115891, 122.0598851],
        [6.9112243, 122.0605369],
        [6.9114909, 122.0608107],
        [6.9116104, 122.0607081],
        [6.9117474, 122.0605736],
        [6.9117609, 122.0605571],
        [6.9117718, 122.0605437],
        [6.9118633, 122.060432],
        [6.9119617, 122.0602869],
        [6.9120777, 122.0600533],
        [6.9123096, 122.0596357],
        [6.9124466, 122.0593065],
        [6.9124712, 122.0591579],
        [6.9124758, 122.0591351],
        [6.9124958, 122.0590128],
        [6.9124817, 122.0587969],
        [6.9124044, 122.0585527],
        [6.9119743, 122.057778],
    ],
    [
        [6.912375, 122.0578486],
        [6.9123245, 122.0578649],
        [6.9122923, 122.0578994],
        [6.9122701, 122.0579523],
        [6.9122701, 122.0580072],
        [6.9122923, 122.05806],
        [6.9123387, 122.0581494],
        [6.9124032, 122.0582856],
        [6.912494, 122.0584665],
        [6.9125889, 122.058682],
        [6.9126252, 122.0588202],
        [6.9126289, 122.0588506],
        [6.9126514, 122.0590337],
        [6.9126514, 122.0591313],
        [6.912645, 122.0591752],
        [6.9126414, 122.0592004],
        [6.9126212, 122.0592695],
        [6.9125869, 122.0593671],
        [6.9125606, 122.0594423],
        [6.9132544, 122.0600372],
        [6.9140843, 122.0607489],
        [6.9148843, 122.0595289],
        [6.9150127, 122.0593331],
        [6.9147294, 122.0590635],
        [6.9144933, 122.0588562],
        [6.9142656, 122.058655],
        [6.9140998, 122.0585472],
        [6.9138723, 122.0584076],
        [6.9136241, 122.0582775],
        [6.9132084, 122.0580966],
        [6.9127826, 122.057938],
        [6.912605, 122.0578893],
        [6.9124718, 122.0578608],
        [6.912375, 122.0578486],
    ],
];

export const POLL_MS = 30_000;

// Leaflet needs plain colors. Live is ember-500 (DRRMO "live"), the rest stone-500.
export const pinColors: Record<MapState, string> = {
    live: '#f04e12',
    stale: '#78716c',
    none: '#78716c',
};

// "just now", "3 min ago", "2 h ago". Used for the last seen time next to a person.
export function lastSeen(capturedAt: string, now: number): string {
    const seconds = Math.max(0, Math.round((now - new Date(capturedAt).getTime()) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} h ago`;
}

// The map shows everyone who has a ping. The side list groups people by state, so nobody shows twice.
export function splitPeople(people: MapPerson[]) {
    return {
        onMap: people.filter((p) => p.ping !== null),
        live: people.filter((p) => p.state === 'live'),
        stale: people.filter((p) => p.state === 'stale'),
        none: people.filter((p) => p.state === 'none'),
    };
}

// Events that have someone on duty, for the filter. Taken from the response so a person who holds
// only `location.view` does not need the events permission.
export function eventOptions(people: MapPerson[]): { id: number; title: string }[] {
    const seen = new Map<number, string>();
    for (const p of people) seen.set(p.event_id, p.event_title ?? `Event ${p.event_id}`);
    return [...seen]
        .map(([id, title]) => ({ id, title }))
        .sort((a, b) => a.title.localeCompare(b.title));
}

// Case insensitive match on the person's name or event, for the "Find a person" field.
export function matchesSearch(person: MapPerson, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (q === '') return true;
    return `${person.name} ${person.event_title ?? ''}`.toLowerCase().includes(q);
}

// True when the point falls inside either campus ring. Ray casting, good enough at campus scale.
export function insideCampus(lat: number, lng: number): boolean {
    return CAMPUS_BOUNDARY.some((ring) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [yi, xi] = ring[i];
            const [yj, xj] = ring[j];
            if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    });
}

// Reads typed latitude and longitude. Returns null unless both are numbers in range.
export function parseCoords(lat: string, lng: string): [number, number] | null {
    if (lat.trim() === '' || lng.trim() === '') return null;
    const a = Number(lat);
    const b = Number(lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
    return [a, b];
}

// Six decimals is about 10 cm, more than a phone or a map click can tell apart.
export function formatCoord(n: number): string {
    return n.toFixed(6);
}

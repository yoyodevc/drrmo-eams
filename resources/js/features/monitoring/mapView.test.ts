import { describe, expect, it } from 'vitest';
import type { MapPerson } from './api';
import {
    eventOptions,
    formatCoord,
    insideCampus,
    lastSeen,
    MAP_HOME,
    matchesSearch,
    parseCoords,
    splitPeople,
} from './mapView';

const now = Date.parse('2026-11-13T01:00:00Z');
const person = (id: number, state: MapPerson['state'], event = 1): MapPerson => ({
    assignment_id: id,
    event_id: event,
    event_title: `Event ${event}`,
    name: `P${id}`,
    state,
    ping:
        state === 'none'
            ? null
            : { lat: 6.9, lng: 122, accuracy_m: 5, captured_at: '2026-11-13T00:59:00Z' },
});

describe('lastSeen', () => {
    it('reads in plain words', () => {
        expect(lastSeen('2026-11-13T00:59:40Z', now)).toBe('just now');
        expect(lastSeen('2026-11-13T00:57:00Z', now)).toBe('3 min ago');
        expect(lastSeen('2026-11-13T00:00:00Z', now)).toBe('1 h ago');
        expect(lastSeen('2026-11-13T01:05:00Z', now)).toBe('just now');
    });
});

describe('splitPeople', () => {
    it('puts stale and no-location people in their own lists', () => {
        const people = [person(1, 'live'), person(2, 'stale'), person(3, 'none')];
        const { onMap, live, stale, none } = splitPeople(people);
        expect(onMap.map((p) => p.assignment_id)).toEqual([1, 2]);
        expect(live.map((p) => p.assignment_id)).toEqual([1]);
        expect(stale.map((p) => p.assignment_id)).toEqual([2]);
        expect(none.map((p) => p.assignment_id)).toEqual([3]);
    });
});

describe('eventOptions', () => {
    it('lists each event once, sorted by title', () => {
        const opts = eventOptions([
            person(1, 'live', 2),
            person(2, 'live', 1),
            person(3, 'none', 2),
        ]);
        expect(opts).toEqual([
            { id: 1, title: 'Event 1' },
            { id: 2, title: 'Event 2' },
        ]);
    });
});

describe('matchesSearch', () => {
    it('matches the name or the event, ignoring case and spaces', () => {
        const p = person(7, 'live', 3);
        expect(matchesSearch(p, '')).toBe(true);
        expect(matchesSearch(p, ' p7 ')).toBe(true);
        expect(matchesSearch(p, 'event 3')).toBe(true);
        expect(matchesSearch(p, 'nobody')).toBe(false);
    });
});

describe('insideCampus', () => {
    it('knows the oval is on campus and the sea is not', () => {
        expect(insideCampus(MAP_HOME[0], MAP_HOME[1])).toBe(true);
        expect(insideCampus(6.9, 122.05)).toBe(false);
    });
});

describe('parseCoords', () => {
    it('accepts numbers in range only', () => {
        expect(parseCoords('6.91371', '122.05938')).toEqual([6.91371, 122.05938]);
        expect(parseCoords('', '122')).toBeNull();
        expect(parseCoords('abc', '122')).toBeNull();
        expect(parseCoords('91', '122')).toBeNull();
        expect(formatCoord(6.9137123456)).toBe('6.913712');
    });
});

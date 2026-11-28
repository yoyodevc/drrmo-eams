import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from './api';
import {
    dayKey,
    matchesFilters,
    needsPeople,
    parseDayKey,
    shiftAnchor,
    staffing,
    timeOnDay,
    visibleDays,
} from './calendar';

function event(patch: Partial<CalendarEvent> = {}): CalendarEvent {
    return {
        id: 'e1',
        title: 'Campus fun run',
        status: 'published',
        event_type: { value: 'sports', label: 'Sports' },
        location: 'Oval',
        starts_at: new Date(2026, 10, 7, 8, 0).toISOString(),
        ends_at: new Date(2026, 10, 7, 17, 0).toISOString(),
        people_count: 5,
        places_needed: 8,
        ...patch,
    };
}

describe('calendar dates', () => {
    it('round trips a day key and rejects bad ones', () => {
        expect(dayKey(new Date(2026, 10, 7))).toBe('2026-11-07');
        expect(parseDayKey('2026-11-07')?.getDate()).toBe(7);
        expect(parseDayKey('2026-02-30')).toBeNull();
        expect(parseDayKey('nope')).toBeNull();
    });

    it('shows whole weeks for a month, starting on Sunday', () => {
        const days = visibleDays('month', new Date(2026, 10, 7));
        expect(days).toHaveLength(35);
        expect(days[0].getDay()).toBe(0);
        expect(dayKey(days[0])).toBe('2026-11-01');
        expect(visibleDays('week', new Date(2026, 10, 7))).toHaveLength(7);
        expect(visibleDays('day', new Date(2026, 10, 7))).toHaveLength(1);
    });

    it('keeps the day number when moving months, clamped to the month end', () => {
        expect(dayKey(shiftAnchor('month', new Date(2026, 0, 31), 1))).toBe('2026-02-28');
        expect(dayKey(shiftAnchor('week', new Date(2026, 10, 7), -1))).toBe('2026-10-31');
    });

    it('describes a multi-day event per day', () => {
        const long = event({
            starts_at: new Date(2026, 10, 6, 8, 0).toISOString(),
            ends_at: new Date(2026, 10, 8, 12, 0).toISOString(),
        });
        expect(timeOnDay(long, new Date(2026, 10, 6))).toMatch(/^From /);
        expect(timeOnDay(long, new Date(2026, 10, 7))).toBe('All day');
        expect(timeOnDay(long, new Date(2026, 10, 8))).toMatch(/^Until /);
    });
});

describe('calendar staffing and filters', () => {
    it('rates staffing', () => {
        expect(staffing(event()).tone).toBe('short');
        expect(staffing(event({ people_count: 8 })).tone).toBe('full');
        expect(staffing(event({ places_needed: 0 })).long).toBe('No duties yet');
        expect(staffing(event({ status: 'completed' })).tone).toBe('closed');
    });

    it('flags only active events that still need people', () => {
        expect(needsPeople(event())).toBe(true);
        expect(needsPeople(event({ places_needed: 0, status: 'draft' }))).toBe(true);
        expect(needsPeople(event({ people_count: 8 }))).toBe(false);
        expect(needsPeople(event({ status: 'cancelled' }))).toBe(false);
    });

    it('filters by status, type and need', () => {
        const none = { status: '', type: '', needsPeople: false };
        expect(matchesFilters(event(), none)).toBe(true);
        expect(matchesFilters(event(), { ...none, status: 'draft' })).toBe(false);
        expect(matchesFilters(event(), { ...none, type: 'academic' })).toBe(false);
        expect(matchesFilters(event({ people_count: 8 }), { ...none, needsPeople: true })).toBe(
            false,
        );
    });
});

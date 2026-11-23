import { describe, expect, it } from 'vitest';
import { keyToBytes } from './push';
import { urgencyOf } from './sound';

describe('urgencyOf', () => {
    it('matches the server levels', () => {
        expect(urgencyOf('emergency.reported')).toBe('urgent');
        expect(urgencyOf('emergency.reminder')).toBe('urgent');
        expect(urgencyOf('report.missed')).toBe('urgent');
        expect(urgencyOf('assignment.created')).toBe('important');
        expect(urgencyOf('report.due')).toBe('important');
        expect(urgencyOf('report.reminder')).toBe('normal');
        expect(urgencyOf('consent.withdrawn')).toBe('normal');
    });
});

describe('keyToBytes', () => {
    it('decodes url safe base64 without padding', () => {
        // "hello?>" in url safe base64 is aGVsbG8_Pg
        expect(Array.from(keyToBytes('aGVsbG8_Pg'))).toEqual([104, 101, 108, 108, 111, 63, 62]);
    });
});

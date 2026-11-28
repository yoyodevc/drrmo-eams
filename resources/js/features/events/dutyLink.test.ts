import { describe, expect, it } from 'vitest';
import type { MyAssignment } from '@/features/events/api';
import { findLinkedDuty, linkedAssignmentId } from './dutyLink';

const one = 'abcdefgh23456789';
const two = 'mnpqrstu23456789';

const duty = (id: string, eventStatus = 'published') =>
    ({ id, event: { status: eventStatus } }) as unknown as MyAssignment;

describe('linkedAssignmentId', () => {
    it('reads a public code', () => {
        expect(linkedAssignmentId(one)).toBe(one);
    });
    it('ignores anything else', () => {
        // A record number is not a code.
        for (const bad of [null, '', '0', '42', 'abc', `${one}x`, '1bcdefgh23456789']) {
            expect(linkedAssignmentId(bad)).toBeNull();
        }
    });
});

describe('findLinkedDuty', () => {
    it('finds the duty and says if its event was cancelled', () => {
        const list = [duty(one), duty(two, 'cancelled')];
        expect(findLinkedDuty(list, one)?.cancelled).toBe(false);
        expect(findLinkedDuty(list, two)?.cancelled).toBe(true);
    });
    it('finds nothing for an id that is not in the list', () => {
        expect(findLinkedDuty([duty(one)], two)).toBeNull();
        expect(findLinkedDuty([duty(one)], null)).toBeNull();
    });
});

import { keepLinkedAssignment, loginPathFor } from './dutyLink';

describe('keepLinkedAssignment', () => {
    it('keeps the code on the duties page', () => {
        expect(keepLinkedAssignment('/me', `?assignment=${one}`)).toBe(`/me?assignment=${one}`);
    });
    it('drops a bad value and leaves other pages alone', () => {
        expect(keepLinkedAssignment('/me', '?assignment=abc')).toBe('/me');
        expect(keepLinkedAssignment('/admin', `?assignment=${one}`)).toBe('/admin');
    });
});

describe('loginPathFor', () => {
    it('remembers a good code and ignores anything else', () => {
        expect(loginPathFor(`?assignment=${one}`)).toBe(`/login?assignment=${one}`);
        expect(loginPathFor('?assignment=x')).toBe('/login');
        expect(loginPathFor('')).toBe('/login');
    });
});

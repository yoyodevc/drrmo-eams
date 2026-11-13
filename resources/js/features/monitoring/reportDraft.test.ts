import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/client';
import { clearDraft, fitSize, isNetworkError, readDraft, saveDraft } from './reportDraft';

beforeEach(() => localStorage.clear());

describe('report draft', () => {
    it('keeps the text for one slot and forgets it when cleared', () => {
        saveDraft(1, 'Gate 2 is clear');
        saveDraft(2, 'Other slot');
        expect(readDraft(1)).toBe('Gate 2 is clear');
        expect(readDraft(2)).toBe('Other slot');

        clearDraft(1);
        expect(readDraft(1)).toBe('');
        expect(readDraft(2)).toBe('Other slot');
    });

    it('removes the draft when the text is emptied', () => {
        saveDraft(1, 'x');
        saveDraft(1, '');
        expect(localStorage.length).toBe(0);
    });
});

describe('fitSize', () => {
    it('scales the long side down to 1600 and keeps the shape', () => {
        expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
        expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    });

    it('never makes a small photo bigger', () => {
        expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
        expect(fitSize(1600, 1600)).toEqual({ width: 1600, height: 1600 });
    });
});

describe('isNetworkError', () => {
    it('tells a lost connection from a server answer', () => {
        expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
        expect(isNetworkError(new ApiError(422, { message: 'No' }))).toBe(false);
    });
});

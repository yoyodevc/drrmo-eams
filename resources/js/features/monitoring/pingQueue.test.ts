import { beforeEach, describe, expect, it } from 'vitest';
import type { PingPoint } from './api';
import { BATCH_SIZE, dropSent, enqueue, MAX_QUEUED, nextBatch, readQueue } from './pingQueue';

const point = (n: number): PingPoint => ({
    lat: 6.9,
    lng: 122.0,
    accuracy_m: n,
    captured_at: new Date(1_700_000_000_000 + n * 30_000).toISOString(),
});

beforeEach(() => localStorage.clear());

describe('ping queue', () => {
    it('keeps points in order and survives a reload', () => {
        enqueue(1, point(1));
        enqueue(1, point(2));
        expect(readQueue(1).map((p) => p.accuracy_m)).toEqual([1, 2]);
        expect(readQueue(2)).toEqual([]);
    });

    it('hands out batches of 50 and drops what was sent', () => {
        for (let i = 0; i < 120; i++) enqueue(1, point(i));
        expect(nextBatch(1)).toHaveLength(BATCH_SIZE);
        expect(dropSent(1, BATCH_SIZE)).toBe(70);
        expect(nextBatch(1)[0].accuracy_m).toBe(50);
    });

    it('drops the oldest points past the cap', () => {
        for (let i = 0; i < MAX_QUEUED + 5; i++) enqueue(1, point(i));
        const queue = readQueue(1);
        expect(queue).toHaveLength(MAX_QUEUED);
        expect(queue[0].accuracy_m).toBe(5);
    });

    it('ignores corrupt storage', () => {
        localStorage.setItem('drrmo.pings.1', '{nope');
        expect(readQueue(1)).toEqual([]);
    });
});

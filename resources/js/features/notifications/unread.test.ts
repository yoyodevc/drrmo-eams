import { describe, expect, it } from 'vitest';
import { hasUnread } from './unread';

const item = (sent_at: string | null) => ({
    id: 'n1',
    type: 'assignment.created',
    sent_at,
    event: null,
    assignment_id: null,
});

describe('hasUnread', () => {
    it('is true when something was sent after the last visit', () => {
        expect(hasUnread([item('2026-11-09T01:00:00Z')], Date.parse('2026-11-09T00:00:00Z'))).toBe(
            true,
        );
    });
    it('is false when everything is older', () => {
        expect(hasUnread([item('2026-11-08T01:00:00Z')], Date.parse('2026-11-09T00:00:00Z'))).toBe(
            false,
        );
    });
    it('is false for an empty list', () => {
        expect(hasUnread([], 0)).toBe(false);
    });
});

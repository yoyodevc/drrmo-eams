import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDutyTracker } from './useDutyTracker';

vi.mock('../api', () => ({ uploadPings: vi.fn().mockResolvedValue({ accepted: 1, rejected: 0 }) }));

type Listener = () => void;

// A stand in for the browser's WakeLockSentinel.
function makeSentinel() {
    const listeners: Listener[] = [];
    return {
        release: vi.fn().mockResolvedValue(undefined),
        addEventListener: (_type: 'release', listener: Listener) => listeners.push(listener),
        fireRelease: () => listeners.forEach((l) => l()),
    };
}

function setVisibility(value: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { value, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
    localStorage.clear();
    setVisibility('visible');
    Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
            getCurrentPosition: (ok: (p: unknown) => void) =>
                ok({
                    coords: { latitude: 6.9, longitude: 122, accuracy: 5 },
                    timestamp: Date.now(),
                }),
        },
    });
});

afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('wake lock state', () => {
    it('is active once the lock is granted, and released on hide', async () => {
        const sentinel = makeSentinel();
        const request = vi.fn().mockResolvedValue(sentinel);
        Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

        const { result, unmount } = renderHook(() => useDutyTracker(1, true));
        await waitFor(() => expect(result.current.wakeLock).toBe('active'));
        expect(request).toHaveBeenCalledWith('screen');

        act(() => sentinel.fireRelease());
        expect(result.current.wakeLock).toBe('released');

        unmount();
    });

    it('asks again when the page becomes visible', async () => {
        const first = makeSentinel();
        const second = makeSentinel();
        const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
        Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

        const { result, unmount } = renderHook(() => useDutyTracker(1, true));
        await waitFor(() => expect(result.current.wakeLock).toBe('active'));

        // The browser drops the lock when the page is hidden.
        act(() => {
            first.fireRelease();
            setVisibility('hidden');
        });
        expect(result.current.wakeLock).toBe('released');
        expect(request).toHaveBeenCalledTimes(1);

        act(() => setVisibility('visible'));
        await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(result.current.wakeLock).toBe('active'));

        unmount();
        expect(second.release).toHaveBeenCalled();
    });

    it('says unsupported when the browser has no Wake Lock', async () => {
        const { result, unmount } = renderHook(() => useDutyTracker(1, true));
        await waitFor(() => expect(result.current.wakeLock).toBe('unsupported'));
        unmount();
    });

    it('says denied when the browser refuses the lock', async () => {
        const request = vi
            .fn()
            .mockRejectedValue(new DOMException('Battery saver', 'NotAllowedError'));
        Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

        const { result, unmount } = renderHook(() => useDutyTracker(1, true));
        await waitFor(() => expect(result.current.wakeLock).toBe('denied'));
        unmount();
    });
});

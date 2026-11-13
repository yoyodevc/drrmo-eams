// Helpers for the report form (S4.6): the draft kept on the phone, and photo sizing.
// No React or canvas in here, so they are easy to test.

export const MAX_SUMMARY = 1000;
export const MAX_PHOTO_EDGE = 1600;

const draftKey = (slotId: number) => `drrmo:report-draft:${slotId}`;

export function readDraft(slotId: number): string {
    try {
        return localStorage.getItem(draftKey(slotId)) ?? '';
    } catch {
        return '';
    }
}

// An empty text removes the draft, so nothing stale is left behind.
export function saveDraft(slotId: number, text: string): void {
    try {
        if (text === '') localStorage.removeItem(draftKey(slotId));
        else localStorage.setItem(draftKey(slotId), text);
    } catch {
        // Storage can be full or blocked. The form still works, it just cannot keep a draft.
    }
}

export function clearDraft(slotId: number): void {
    saveDraft(slotId, '');
}

// The size a photo is drawn at so its long side is at most `max`. Never makes a photo bigger.
export function fitSize(width: number, height: number, max = MAX_PHOTO_EDGE) {
    const longest = Math.max(width, height);
    if (longest <= max) return { width, height };
    const scale = max / longest;
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// True when the call failed because there was no network, not because the server said no.
export function isNetworkError(error: unknown): boolean {
    return error instanceof TypeError;
}

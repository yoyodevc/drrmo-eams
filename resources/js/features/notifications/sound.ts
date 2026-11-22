// In app alert sound and vibration. Two short tones in /sounds: an alarm (loops until stopped) and a
// chime (plays once). Browsers allow sound only after the person has tapped the page once, so
// unlock() runs from a tap. Vibration works on Android only (iPhone has none).
export type Urgency = 'urgent' | 'important' | 'normal';

// Same map as NotificationType::urgency() on the server.
const urgent = new Set([
    'emergency.reported',
    'emergency.reminder',
    'emergency.escalated',
    'report.missed',
]);
const important = new Set([
    'report.overdue',
    'report.due',
    'assignment.created',
    'assignment.changed',
    'assignment.cancelled',
]);

export function urgencyOf(type: string): Urgency {
    return urgent.has(type) ? 'urgent' : important.has(type) ? 'important' : 'normal';
}

const URGENT_VIBRATION = [600, 200, 600, 200, 600];

// One audio element plays both tones. iPhones unlock sound for one element, and an element that was
// started by a real tap may play again later (and change its file) without another tap.
const CHIME = '/sounds/chime.wav';
const ALARM = '/sounds/alarm.wav';
let player: HTMLAudioElement | null = null;
let current = '';
let unlocked = false;
const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach((l) => l());
}

function load(src: string, loop: boolean): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    player ??= new Audio(src);
    if (current !== src) {
        player.src = src;
        current = src;
    }
    player.loop = loop;
    player.preload = 'auto';
    return player;
}

export function subscribeSound(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function isUnlocked(): boolean {
    return unlocked;
}

// Call from a real tap (click or touchend). Plays the chime for a moment, then stops it. The browser
// refuses when the call did not come from a tap, so success means sound really is allowed. A muted
// play is not used: iPhones accept it without a tap, which would look unlocked when it is not.
export function unlock(): Promise<boolean> {
    // A tap makes both a touchend and a click, so share one attempt.
    pending ??= tryUnlock().finally(() => {
        pending = null;
    });
    return pending;
}

let pending: Promise<boolean> | null = null;

async function tryUnlock(): Promise<boolean> {
    if (unlocked) return true;
    const el = load(CHIME, false);
    if (!el) return false;
    try {
        await el.play();
        el.pause();
        el.currentTime = 0;
        unlocked = true;
    } catch {
        unlocked = false;
    }
    emit();
    return unlocked;
}

export function playChime(): void {
    if (!unlocked) return;
    const el = load(CHIME, false);
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => undefined);
    vibrate([200]);
}

export function startAlarm(): void {
    vibrate(URGENT_VIBRATION);
    if (!unlocked) return;
    const el = load(ALARM, true);
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
}

export function stopAlarm(): void {
    if (player && current === ALARM) {
        player.pause();
        player.currentTime = 0;
    }
    vibrate(0);
}

export function isAlarmPlaying(): boolean {
    return player !== null && current === ALARM && !player.paused;
}

function vibrate(pattern: number | number[]): void {
    try {
        if ('vibrate' in navigator) navigator.vibrate(pattern);
    } catch {
        // Not allowed on this device or page.
    }
}

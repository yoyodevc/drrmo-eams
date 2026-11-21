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

let alarm: HTMLAudioElement | null = null;
let chime: HTMLAudioElement | null = null;
let unlocked = false;
const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach((l) => l());
}

function make(src: string, loop: boolean): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    const el = new Audio(src);
    el.loop = loop;
    el.preload = 'auto';
    return el;
}

export function subscribeSound(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function isUnlocked(): boolean {
    return unlocked;
}

// Call from a tap or click. Plays the chime silently once so later sounds are allowed.
export async function unlock(): Promise<boolean> {
    chime ??= make('/sounds/chime.wav', false);
    alarm ??= make('/sounds/alarm.wav', true);
    if (!chime || !alarm) return false;
    try {
        for (const el of [chime, alarm]) {
            el.muted = true;
            await el.play();
            el.pause();
            el.currentTime = 0;
            el.muted = false;
        }
        unlocked = true;
    } catch {
        unlocked = false;
    }
    emit();
    return unlocked;
}

export function playChime(): void {
    if (!unlocked || !chime) return;
    chime.currentTime = 0;
    void chime.play().catch(() => undefined);
    vibrate([200]);
}

export function startAlarm(): void {
    vibrate(URGENT_VIBRATION);
    if (!unlocked || !alarm) return;
    void alarm.play().catch(() => undefined);
}

export function stopAlarm(): void {
    if (alarm) {
        alarm.pause();
        alarm.currentTime = 0;
    }
    vibrate(0);
}

export function isAlarmPlaying(): boolean {
    return alarm !== null && !alarm.paused;
}

function vibrate(pattern: number | number[]): void {
    try {
        if ('vibrate' in navigator) navigator.vibrate(pattern);
    } catch {
        // Not allowed on this device or page.
    }
}

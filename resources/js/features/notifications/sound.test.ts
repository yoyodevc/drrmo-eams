import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The WAV files are 16 bit mono. Returns the sample rate and samples scaled to -1..1.
function readWav(name: string) {
    const buf = readFileSync(`public/sounds/${name}`);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    const rate = buf.readUInt32LE(24);
    expect([buf.readUInt16LE(22), buf.readUInt16LE(34)]).toEqual([1, 16]);
    const data = buf.subarray(44);
    const samples = Array.from(
        { length: data.length / 2 },
        (_, i) => data.readInt16LE(i * 2) / 32768,
    );
    return { rate, samples, bytes: buf.length };
}

// Pitch by counting rising zero crossings in a window.
function pitch(samples: number[], rate: number, from: number, to: number): number {
    let crossings = 0;
    for (let i = Math.floor(from * rate) + 1; i < Math.floor(to * rate); i++) {
        if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
    }
    return crossings / (to - from);
}

const peakOf = (xs: number[]) => xs.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

describe('sound files', () => {
    it('alarm is a short loop of two alternating tones, 880 and 660 Hz', () => {
        const { rate, samples, bytes } = readWav('alarm.wav');
        expect(samples.length / rate).toBeCloseTo(1.2, 1);
        expect(bytes).toBeLessThan(100_000);
        expect(peakOf(samples)).toBeGreaterThan(0.3);
        expect(peakOf(samples)).toBeLessThanOrEqual(1);
        expect(pitch(samples, rate, 0.03, 0.17)).toBeGreaterThan(820);
        expect(pitch(samples, rate, 0.03, 0.17)).toBeLessThan(940);
        expect(pitch(samples, rate, 0.23, 0.37)).toBeGreaterThan(620);
        expect(pitch(samples, rate, 0.23, 0.37)).toBeLessThan(700);
        // Loops cleanly: starts and ends near silence, so there is no click.
        expect(Math.abs(samples[0])).toBeLessThan(0.05);
        expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.05);
    });

    it('chime is a soft two note ding that fades out', () => {
        const { rate, samples, bytes } = readWav('chime.wav');
        expect(samples.length / rate).toBeLessThan(1);
        expect(bytes).toBeLessThan(60_000);
        const win = (a: number, b: number) =>
            samples.slice(Math.floor(a * rate), Math.floor(b * rate));
        expect(peakOf(win(0, 0.1))).toBeGreaterThan(0.1);
        expect(peakOf(win(0.2, 0.35))).toBeGreaterThan(0.1);
        expect(peakOf(win(0.6, 0.7))).toBeLessThan(0.1);
        expect(pitch(samples, rate, 0.02, 0.15)).toBeGreaterThan(740);
        expect(pitch(samples, rate, 0.02, 0.15)).toBeLessThan(830);
    });
});

class FakeAudio {
    static all: FakeAudio[] = [];
    loop = false;
    muted = false;
    paused = true;
    currentTime = 0;
    preload = '';
    plays = 0;
    constructor(public src: string) {
        FakeAudio.all.push(this);
    }
    play() {
        this.paused = false;
        this.plays++;
        return Promise.resolve();
    }
    pause() {
        this.paused = true;
    }
}

describe('sound engine', () => {
    let sound: typeof import('./sound');
    const vibrate = vi.fn();

    beforeEach(async () => {
        FakeAudio.all = [];
        vi.resetModules();
        vi.stubGlobal('Audio', FakeAudio);
        Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
        vibrate.mockClear();
        sound = await import('./sound');
    });
    afterEach(() => vi.unstubAllGlobals());

    const audio = (name: string) => FakeAudio.all.find((a) => a.src.includes(name));

    it('stays silent until unlocked, but still vibrates for an urgent alert', () => {
        sound.playChime();
        sound.startAlarm();
        expect(FakeAudio.all.every((a) => a.plays === 0)).toBe(true);
        expect(vibrate).toHaveBeenCalledWith([600, 200, 600, 200, 600]);
        expect(sound.isUnlocked()).toBe(false);
    });

    it('unlocks from a tap, then chimes once and loops the alarm until stopped', async () => {
        expect(await sound.unlock()).toBe(true);
        expect(sound.isUnlocked()).toBe(true);
        expect(audio('alarm.wav')?.loop).toBe(true);
        expect(audio('chime.wav')?.loop).toBe(false);
        expect(audio('alarm.wav')?.paused).toBe(true);

        const before = audio('chime.wav')!.plays;
        sound.playChime();
        expect(audio('chime.wav')!.plays).toBe(before + 1);
        expect(vibrate).toHaveBeenLastCalledWith([200]);

        sound.startAlarm();
        expect(audio('alarm.wav')?.paused).toBe(false);
        expect(sound.isAlarmPlaying()).toBe(true);
        sound.stopAlarm();
        expect(audio('alarm.wav')?.paused).toBe(true);
        expect(sound.isAlarmPlaying()).toBe(false);
        expect(vibrate).toHaveBeenLastCalledWith(0);
    });

    it('stays locked when the browser refuses playback', async () => {
        class Refusing extends FakeAudio {
            play() {
                return Promise.reject(new Error('NotAllowedError'));
            }
        }
        vi.stubGlobal('Audio', Refusing);
        vi.resetModules();
        const fresh = await import('./sound');
        expect(await fresh.unlock()).toBe(false);
        expect(fresh.isUnlocked()).toBe(false);
    });

    it('tells listeners when sound unlocks', async () => {
        const listener = vi.fn();
        sound.subscribeSound(listener);
        await sound.unlock();
        expect(listener).toHaveBeenCalled();
    });
});

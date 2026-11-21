// Web Push on this device: can it, is it on, turn it on or off. The browser asks for permission
// only after a tap (see AlertSettings). Push needs HTTPS (or localhost) and, on iPhone, an app
// installed to the Home Screen.
import { subscribePush, unsubscribePush } from './api';

export type PushSupport =
    | 'ready' // this device can turn alerts on
    | 'install' // iPhone in a browser tab: install to the Home Screen first
    | 'unsupported'; // no service worker, no Push API, or not a secure page

export function isIos(): boolean {
    const ua = navigator.userAgent;
    return (
        /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    );
}

export function isInstalled(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

export function pushSupport(): PushSupport {
    if (isIos() && !isInstalled()) return 'install';
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return 'unsupported';
    }
    return 'ready';
}

export function deviceLabel(): string {
    const ua = navigator.userAgent;
    const os = /Android/.test(ua)
        ? 'Android'
        : isIos()
          ? 'iPhone'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Mac/.test(ua)
              ? 'Mac'
              : /Linux/.test(ua)
                ? 'Linux'
                : 'Device';
    const browser = /Edg\//.test(ua)
        ? 'Edge'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'browser';
    return `${os} ${browser}`.slice(0, 80);
}

// The public key is URL safe base64. PushManager wants the raw bytes.
export function keyToBytes(key: string): Uint8Array<ArrayBuffer> {
    const padded = (key + '='.repeat((4 - (key.length % 4)) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const raw = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    // Dev builds do not register the worker on load, so make sure it is there.
    const existing = await navigator.serviceWorker.getRegistration('/');
    return existing ?? navigator.serviceWorker.register('/sw.js');
}

export async function currentSubscription(): Promise<PushSubscription | null> {
    try {
        const reg = await registration();
        if (!reg) return null;
        await navigator.serviceWorker.ready;
        return await reg.pushManager.getSubscription();
    } catch {
        return null;
    }
}

// Must be called from a tap. Throws 'denied' when the person says no.
export async function enablePush(publicKey: string): Promise<void> {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('denied');
    const reg = await registration();
    if (!reg) throw new Error('unsupported');
    await navigator.serviceWorker.ready;
    const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyToBytes(publicKey),
        }));
    await subscribePush(sub.toJSON(), deviceLabel());
}

// Turns alerts off for this device: the server forgets it and the browser drops it.
export async function disablePush(): Promise<void> {
    const sub = await currentSubscription();
    if (!sub) return;
    await unsubscribePush(sub.endpoint);
    await sub.unsubscribe();
}

// Used on sign out. Never blocks signing out.
export async function forgetThisDevice(): Promise<void> {
    try {
        if (pushSupport() === 'unsupported') return;
        await disablePush();
    } catch {
        // The server row is removed on the next failed push at the latest.
    }
}

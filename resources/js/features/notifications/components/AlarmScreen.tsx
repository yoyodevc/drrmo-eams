// Full screen alarm for an urgent alert. Phones get the whole screen in maroon. From 640 px it is a
// centered card over a dim backdrop. Focus stays inside until the person picks one of the two buttons,
// and Escape does nothing, so the alarm is never closed by accident.
import { useEffect, useId, useRef } from 'react';

export interface AlarmScreenProps {
    alerts: { id: string; text: string }[];
    // Label of the main button, for example "Open emergencies".
    openLabel: string;
    // Stops the alarm and opens the screen where the emergency is handled.
    onAcknowledge: () => void;
    // Stops the alarm and stays where you are.
    onDismiss: () => void;
}

export function AlarmScreen({ alerts, openLabel, onAcknowledge, onDismiss }: AlarmScreenProps) {
    const titleId = useId();
    const bodyId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const openRef = useRef<HTMLButtonElement>(null);
    const more = Math.max(alerts.length - 1, 0);

    useEffect(() => {
        const previous =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        openRef.current?.focus();

        function onKeyDown(e: KeyboardEvent) {
            const dialog = dialogRef.current;
            if (!dialog) return;
            if (e.key === 'Escape') {
                // Escape must not silence an emergency. Keep the person on the main button.
                e.preventDefault();
                e.stopPropagation();
                openRef.current?.focus();
                return;
            }
            if (e.key !== 'Tab') return;
            const items = dialog.querySelectorAll<HTMLElement>('button:not([disabled])');
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            const outside = !dialog.contains(active);
            if (e.shiftKey && (active === first || outside)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || outside)) {
                e.preventDefault();
                first.focus();
            }
        }

        function onFocusIn(e: FocusEvent) {
            if (!dialogRef.current?.contains(e.target as Node)) openRef.current?.focus();
        }

        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('focusin', onFocusIn);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('focusin', onFocusIn);
            document.body.style.overflow = overflow;
            if (previous?.isConnected) previous.focus();
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[1100] flex bg-maroon-950 motion-safe:animate-backdrop-in sm:items-center sm:justify-center sm:bg-maroon-950/75 sm:p-6">
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={bodyId}
                className="on-dark flex w-full flex-col overflow-y-auto overscroll-contain bg-maroon-900 px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white motion-safe:animate-dialog-in sm:max-h-[calc(100dvh-3rem)] sm:max-w-md sm:rounded-card sm:p-8 sm:shadow-raised sm:ring-1 sm:ring-white/10"
            >
                <div className="flex flex-1 flex-col items-center justify-center text-center sm:flex-none">
                    <div className="relative mb-7 grid size-24 place-items-center">
                        <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full bg-red-500/30 motion-safe:animate-ping"
                            style={{ animationDuration: '2.4s' }}
                        />
                        <span className="relative grid size-24 place-items-center rounded-full bg-red-700 ring-4 ring-red-500/30">
                            <svg
                                viewBox="0 0 24 24"
                                className="size-12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M12 9v4.5M12 17v.01M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
                            </svg>
                        </span>
                    </div>

                    <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-gold-300 uppercase">
                        <span aria-hidden="true" className="h-px w-6 bg-gold-400" />
                        Needs action now
                        <span aria-hidden="true" className="h-px w-6 bg-gold-400" />
                    </p>
                    <h2
                        id={titleId}
                        className="mt-3 text-3xl font-bold tracking-tight text-balance"
                    >
                        Urgent alert
                    </h2>

                    <div id={bodyId} className="mt-6 w-full space-y-3">
                        <p className="rounded-control border-l-4 border-gold-400 bg-red-700 px-4 py-3 text-left text-lg font-semibold text-pretty">
                            {alerts[0]?.text}
                        </p>
                        {more > 0 && (
                            <p className="text-sm font-medium text-gold-200">
                                +{more} more urgent {more === 1 ? 'alert' : 'alerts'}
                            </p>
                        )}
                        <p className="text-sm text-pretty text-white/75">
                            The alarm rings until you open the alert or dismiss it.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                    <button
                        ref={openRef}
                        type="button"
                        onClick={onAcknowledge}
                        className="inline-flex min-h-14 w-full items-center justify-center rounded-control bg-white px-5 text-lg font-semibold text-maroon-800 transition-colors hover:bg-maroon-50 active:bg-maroon-100"
                    >
                        {openLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="inline-flex min-h-12 w-full items-center justify-center rounded-control px-5 text-base font-semibold text-white ring-1 ring-white/40 transition-colors ring-inset hover:bg-white/10 active:bg-white/15"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}

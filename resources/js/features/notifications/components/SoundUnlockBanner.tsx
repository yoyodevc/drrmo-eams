// One tap step that lets the browser play alert sounds. Shown until the person taps it (or the page).
// Same amber look as the in app alerts in EmergencyAlertBanner.
export function SoundUnlockBanner({ onTurnOn }: { onTurnOn: () => void }) {
    return (
        <div
            role="status"
            className="mb-4 flex items-center gap-3 rounded-control bg-amber-100 px-4 py-2 text-amber-950 ring-1 ring-amber-300"
        >
            <svg
                viewBox="0 0 24 24"
                className="size-6 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M11 5 6 9H3v6h3l5 4V5ZM16 9.5l5 5M21 9.5l-5 5" />
            </svg>
            <p className="min-w-0 flex-1 text-sm font-medium text-pretty">
                Alert sound is off. Turn it on so urgent alerts can ring.
            </p>
            <button
                type="button"
                onClick={onTurnOn}
                className="inline-flex min-h-12 shrink-0 items-center rounded-control bg-amber-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-900"
            >
                Turn on sound
            </button>
        </div>
    );
}

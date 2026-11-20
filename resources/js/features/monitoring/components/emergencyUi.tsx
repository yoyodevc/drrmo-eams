// Small shared pieces for the emergency screens: a type icon and a status chip.
// Outline icons only, and every chip has a word, so nothing relies on color alone.
import type { EmergencyType } from '../api';

const paths: Record<EmergencyType, string> = {
    medical: 'M12 5v14M5 12h14',
    fire: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-.5-5 1-8Z',
    security: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z',
    other: 'M12 8v5M12 16.5v.5M4 20h16L12 4 4 20Z',
};

export function TypeIcon({
    type,
    className = 'size-6',
}: {
    type: EmergencyType;
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d={paths[type]} />
        </svg>
    );
}

const chips = {
    sent: { label: 'Sent', chip: 'bg-sky-50 text-sky-800 ring-sky-200' },
    new: { label: 'New', chip: 'bg-red-50 text-red-800 ring-red-200' },
    escalated: { label: 'Escalated', chip: 'bg-red-100 text-red-900 ring-red-300' },
    acknowledged: { label: 'Acknowledged', chip: 'bg-green-50 text-green-800 ring-green-200' },
    resolved: { label: 'Resolved', chip: 'bg-stone-100 text-stone-600 ring-stone-200' },
} as const;

export type ChipKey = keyof typeof chips;

export function StatusChip({ kind, label }: { kind: ChipKey; label?: string }) {
    const c = chips[kind];
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.chip}`}
        >
            {label ?? c.label}
        </span>
    );
}

// Tile color for a type icon, by how urgent the report still is.
export function typeTone(open: boolean): string {
    return open ? 'text-red-700 ring-red-200' : 'text-stone-500 ring-stone-200';
}

// Shared pieces for the Reports tabs: the white panel, status chips, a few line icons, and the
// time helpers. Times read as "12 min ago" first, because on an emergency that is what matters.
import { useEffect, useState, type ReactNode } from 'react';
import type { ReportStatus } from '../api';

export const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

export const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

// "9:41 AM" for today, "Nov 19, 9:41 AM" for any other day.
export function when(iso: string, now: number): string {
    const d = new Date(iso);
    return d.toDateString() === new Date(now).toDateString() ? clock.format(d) : stamp.format(d);
}

// "Today", "Yesterday", or "Wed, Nov 26", for day headings in a list.
const dayStamp = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
});

export function dayLabel(iso: string, now: number): string {
    const d = new Date(iso);
    const today = new Date(now);
    if (d.toDateString() === today.toDateString()) return 'Today';
    today.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Yesterday';
    return dayStamp.format(d);
}

// "Just now", "12 min ago", "3 hr ago", "2 days ago".
export function ago(iso: string, now: number): string {
    const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
}

// The current time, refreshed every 30 seconds so "min ago" labels stay true.
export function useNow(every = 30_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), every);
        return () => window.clearInterval(timer);
    }, [every]);
    return now;
}

// "medical" to "Medical".
export function typeName(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
}

export function nameParts(name: string | null): [string, string] {
    const parts = (name ?? '').trim().split(/\s+/);
    return [parts[0] ?? '', parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''];
}

// A white panel with a title row, the same shape as the People and Memos lists.
export function Panel({
    id,
    title,
    count,
    aside,
    children,
}: {
    id: string;
    title: string;
    count?: number;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section
            aria-labelledby={id}
            className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
        >
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-stone-200 px-4 md:px-5">
                <h2 id={id} className="flex items-center gap-2 font-semibold text-stone-900">
                    {title}
                    {count !== undefined && (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600 tabular-nums">
                            {count}
                        </span>
                    )}
                </h2>
                {aside}
            </div>
            {children}
        </section>
    );
}

export const linkClass =
    'inline-flex min-h-10 shrink-0 items-center gap-1 rounded-sm text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline';

export const headCell =
    'px-5 py-3 whitespace-nowrap text-xs font-semibold tracking-wide text-stone-500 uppercase';

export const chipBase =
    'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset';

const reportChips: Record<ReportStatus, { label: string; tone: string }> = {
    submitted: { label: 'On time', tone: 'bg-green-50 text-green-800 ring-green-200' },
    late: { label: 'Late', tone: 'bg-amber-50 text-amber-900 ring-amber-200' },
    overdue: { label: 'Overdue', tone: 'bg-ember-50 text-ember-700 ring-ember-200' },
    missed: { label: 'Missed', tone: 'bg-red-50 text-red-800 ring-red-200' },
    pending: { label: 'Due', tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
};

export function ReportChip({ status }: { status: ReportStatus }) {
    const c = reportChips[status];
    return <span className={`${chipBase} ${c.tone}`}>{c.label}</span>;
}

type IconProps = { className?: string };

function Icon({ className = 'size-5', children }: IconProps & { children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

export const ChevronIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="m9 6 6 6-6 6" />
    </Icon>
);

export const CheckIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
);

export const ClockIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
    </Icon>
);

export const PinIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
        <circle cx="12" cy="10" r="2.3" />
    </Icon>
);

export const ShieldUserIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
        <circle cx="12" cy="10" r="2.2" />
        <path d="M8.5 16a4 4 0 0 1 7 0" />
    </Icon>
);

export const InboxIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M4 13.5 6.5 5h11l2.5 8.5V19H4v-5.5Z" />
        <path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20" />
    </Icon>
);

export const ExternalIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
    </Icon>
);

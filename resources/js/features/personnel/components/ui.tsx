// Small shared pieces for the people screens: line icons, the availability chip, initials and dates.
// Icons follow DESIGN_SYSTEM.md section 6: 24 px grid, 1.8 stroke, round caps.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Availability } from '@/features/personnel/volunteers';

type IconProps = { className?: string };

function Icon({ className = 'size-5', children }: { className?: string; children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

export const BackIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="m15 6-6 6 6 6" />
    </Icon>
);

export const ChevronIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="m9 6 6 6-6 6" />
    </Icon>
);

export const ChevronDownIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="m6 9 6 6 6-6" />
    </Icon>
);

export const SearchIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
    </Icon>
);

export const PlusIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M12 5v14M5 12h14" />
    </Icon>
);

export const FilterIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M4 6h16M7 12h10M10 18h4" />
    </Icon>
);

export const PeopleIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </Icon>
);

export const PhoneIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16 13l4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4.5 6a2 2 0 0 1 2-2Z" />
    </Icon>
);

export const MailIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 6.5 8.5 6 8.5-6" />
    </Icon>
);

export const EditIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
        <path d="m13.5 6.5 4 4" />
    </Icon>
);

export const LockIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
);

export const HistoryIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />
        <path d="M12 8v4l3 2" />
    </Icon>
);

export const ClockIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
    </Icon>
);

export const TrashIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M4.5 7h15M10 11v6M14 11v6M9 7V4.5h6V7" />
        <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5l.8-12" />
    </Icon>
);

export const InfoIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 11v5.5M12 7.8v.2" />
    </Icon>
);

export const chipBase =
    'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset';

export function AvailabilityChip({ status }: { status: Availability }) {
    return status === 'active' ? (
        <span className={`${chipBase} bg-green-50 text-green-800 ring-green-200`}>Active</span>
    ) : (
        <span className={`${chipBase} bg-stone-100 text-stone-600 ring-stone-200`}>Inactive</span>
    );
}

export function initials(first: string, last: string): string {
    return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || '?';
}

// Initials in a quiet stone circle. Decorative: the name always sits next to it.
export function Avatar({
    first,
    last,
    size = 'md',
    dim = false,
}: {
    first: string;
    last: string;
    size?: 'md' | 'lg';
    dim?: boolean;
}) {
    const sizing = size === 'lg' ? 'size-14 text-lg' : 'size-10 text-sm';
    return (
        <span
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ring-1 ring-inset ${sizing} ${dim ? 'bg-stone-50 text-stone-500 ring-stone-200' : 'bg-stone-100 text-stone-700 ring-stone-200'}`}
        >
            {initials(first, last)}
        </span>
    );
}

const dateTime = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

const dateOnly = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

export function stamp(iso: string | null): string | null {
    return iso ? dateTime.format(new Date(iso)) : null;
}

export function day(iso: string | null): string | null {
    return iso ? dateOnly.format(new Date(iso)) : null;
}

// Back link at the top of a detail screen. 48 px tall so it is easy to tap.
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link
            to={to}
            className="-mt-2 -ml-2 inline-flex min-h-12 items-center gap-1 rounded-control px-2 text-sm font-medium text-stone-700 transition-colors hover:text-stone-900"
        >
            <BackIcon className="size-5" />
            {children}
        </Link>
    );
}

// Line icons for the notification screens: 24 px grid, 1.8 stroke, round caps (DESIGN_SYSTEM.md section 6).
import type { ReactNode } from 'react';

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

export function BellIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
            <path d="M10 20a2 2 0 0 0 4 0" />
        </Icon>
    );
}

export function MailIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3.5 6.5 8.5 6 8.5-6" />
        </Icon>
    );
}

export function AssignedIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M9 4.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="3" rx="1" />
            <path d="M12 10.5v6M9 13.5h6" />
        </Icon>
    );
}

export function ChangedIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
            <path d="m13.5 6.5 4 4" />
        </Icon>
    );
}

export function CancelledIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="m9 9 6 6M15 9l-6 6" />
        </Icon>
    );
}

export function RefreshIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4.5v4h4M4 13a8 8 0 0 0 14.6 4.5M20 19.5v-4h-4" />
        </Icon>
    );
}

export function SearchIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.4-4.4" />
        </Icon>
    );
}

export function ChevronDownIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="m6 9 6 6 6-6" />
        </Icon>
    );
}

export function ChevronRightIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="m9 6 6 6-6 6" />
        </Icon>
    );
}

export function ClockIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
        </Icon>
    );
}

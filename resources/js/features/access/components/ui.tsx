// Small shared pieces for the access control screens: the permission switch, the matrix tick box,
// role chips, the page header and the save bar. Icons follow DESIGN_SYSTEM.md section 6.
import { useEffect, type ReactNode } from 'react';
import type { PermissionDef, PermissionGroup, Role } from '@/features/access/api';
import { chipBase, LockIcon } from '@/features/personnel/components/ui';
import { Button } from '@/shared/ui/Button';

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

export const ShieldIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
        <path d="m9.5 12 1.8 1.8 3.2-3.3" />
    </Icon>
);

export const GridIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
        <path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17" />
    </Icon>
);

export const TimerIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <circle cx="12" cy="13" r="7.5" />
        <path d="M12 9.5V13l2.5 1.5M9.5 2.5h5" />
    </Icon>
);

export const CheckIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
);

export const CopyIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
        <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </Icon>
);

// Brand stripe, title, one line of help and the page actions on the right.
export function PageHeader({
    title,
    children,
    actions,
}: {
    title: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
            <div className="min-w-0">
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    {title}
                </h1>
                {children && <p className="mt-1 max-w-xl text-pretty text-stone-600">{children}</p>}
            </div>
            {actions && (
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">{actions}</div>
            )}
        </header>
    );
}

export function RoleTypeChip({ role }: { role: Pick<Role, 'is_system'> }) {
    return role.is_system ? (
        <span className={`${chipBase} bg-stone-100 text-stone-600 ring-stone-200`}>Built-in</span>
    ) : (
        <span className={`${chipBase} bg-maroon-50 text-maroon-800 ring-maroon-200`}>Custom</span>
    );
}

// An on and off switch for one permission. 44 by 24 px, inside a 48 px tall row that is the
// real tap target. A locked switch keeps its state and shows a lock instead of the thumb icon.
export function Switch({
    on,
    locked = false,
    label,
    describedBy,
    onChange,
}: {
    on: boolean;
    locked?: boolean;
    label: string;
    describedBy?: string;
    onChange: (on: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            aria-describedby={describedBy}
            aria-disabled={locked || undefined}
            onClick={() => !locked && onChange(!on)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 ${
                on
                    ? locked
                        ? 'bg-maroon-700/45'
                        : 'bg-maroon-700 hover:bg-maroon-800'
                    : locked
                      ? 'bg-stone-200'
                      : 'bg-stone-300 hover:bg-stone-400'
            } ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                aria-hidden="true"
                className={`flex size-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-150 ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
            >
                {locked && <LockIcon className="size-3 text-stone-500" />}
            </span>
        </button>
    );
}

// A tick box for one matrix cell. Changed cells get an amber ring until they are saved, so the
// admin can see exactly what Save will change.
export function MatrixCheck({
    on,
    locked,
    changed,
    label,
    title,
    onChange,
}: {
    on: boolean;
    locked: boolean;
    changed: boolean;
    label: string;
    title?: string;
    onChange: (on: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={label}
            aria-disabled={locked || undefined}
            title={title}
            onClick={() => !locked && onChange(!on)}
            className={`group inline-flex size-10 items-center justify-center rounded-control transition-colors ${locked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-stone-100'} ${changed ? 'bg-amber-50 ring-1 ring-amber-300 ring-inset hover:bg-amber-100' : ''}`}
        >
            {locked ? (
                <span
                    aria-hidden="true"
                    className={`flex size-5 items-center justify-center rounded-[5px] ${on ? 'bg-stone-200 text-stone-600' : 'text-stone-300'}`}
                >
                    {on ? <CheckIcon className="size-3.5" /> : <LockIcon className="size-4" />}
                </span>
            ) : (
                <span
                    aria-hidden="true"
                    className={`flex size-5 items-center justify-center rounded-[5px] ring-1 transition-colors ring-inset ${on ? 'bg-maroon-700 text-white ring-maroon-700' : 'bg-white text-transparent ring-stone-300 group-hover:ring-stone-400'}`}
                >
                    <CheckIcon className="size-3.5" />
                </span>
            )}
        </button>
    );
}

// Sticks to the bottom of the screen while there are unsaved changes. It is always in the layout,
// only hidden, so the page never jumps when it appears.
export function SaveBar({
    changes,
    saving,
    error,
    onSave,
    onDiscard,
}: {
    changes: number;
    saving: boolean;
    error: string | null;
    onSave: () => void;
    onDiscard: () => void;
}) {
    const shown = changes > 0 || error !== null;

    useEffect(() => {
        if (changes === 0) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [changes]);

    return (
        <div
            aria-hidden={!shown || undefined}
            className={`sticky bottom-4 z-20 mt-6 transition-[opacity,translate] duration-200 ease-out ${shown ? 'translate-y-0 opacity-100' : 'pointer-events-none invisible translate-y-2 opacity-0'}`}
        >
            <div className="on-dark flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card bg-stone-900 px-4 py-3 text-white shadow-raised sm:px-5">
                <p className="min-w-0 flex-1 text-sm" role="status">
                    {error ? (
                        <span className="font-medium text-red-200">{error}</span>
                    ) : (
                        <>
                            <span className="font-semibold tabular-nums">{changes}</span> unsaved{' '}
                            {changes === 1 ? 'change' : 'changes'}.{' '}
                            <span className="text-white/70">
                                Saved changes apply at once and go in the audit log.
                            </span>
                        </>
                    )}
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onDiscard}
                        disabled={saving}
                        className="inline-flex min-h-10 items-center rounded-control px-4 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                        Discard
                    </button>
                    <Button
                        variant="secondary"
                        size="md"
                        loading={saving}
                        onClick={onSave}
                        disabled={changes === 0}
                    >
                        {saving ? 'Saving...' : 'Save changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Permissions in their groups, in the order the server gives the groups.
export function grouped(
    permissions: PermissionDef[],
    groups: PermissionGroup[],
): { group: PermissionGroup; items: PermissionDef[] }[] {
    return groups
        .map((group) => ({ group, items: permissions.filter((p) => p.group === group.key) }))
        .filter((g) => g.items.length > 0);
}

// The codes a role will hold once the pending changes are saved.
export function withChanges(role: Role, pending: Record<string, boolean> | undefined): string[] {
    const set = new Set(role.permissions);
    for (const [code, on] of Object.entries(pending ?? {})) {
        if (on) set.add(code);
        else set.delete(code);
    }
    return [...set].sort();
}

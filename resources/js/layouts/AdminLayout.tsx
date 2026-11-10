import { useEffect, useId, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useMe } from '@/app/auth';
import { SignOutButton } from '@/app/SignOutButton';
import { BrandLogos } from '@/shared/ui/BrandLogos';

function NavIcon({ children }: { children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-5 shrink-0"
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

interface Item {
    to: string;
    label: string;
    icon: ReactNode;
    // Dashboard is the index route, so it should only light up on /admin itself.
    end?: boolean;
}

const groups: { label: string; items: Item[] }[] = [
    {
        label: 'Operations',
        items: [
            {
                to: '/admin',
                label: 'Dashboard',
                end: true,
                icon: (
                    <NavIcon>
                        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
                        <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
                        <rect x="13.5" y="11" width="7" height="9.5" rx="1.5" />
                        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
                    </NavIcon>
                ),
            },
            {
                to: '/admin/events',
                label: 'Events',
                icon: (
                    <NavIcon>
                        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                        <path d="M3.5 10h17M8 3v4M16 3v4" />
                    </NavIcon>
                ),
            },
            {
                to: '/admin/map',
                label: 'Map',
                icon: (
                    <NavIcon>
                        <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2Z" />
                        <path d="M9 4.5v13M15 6.5v13" />
                    </NavIcon>
                ),
            },
            {
                to: '/admin/reports',
                label: 'Reports',
                icon: (
                    <NavIcon>
                        <path d="M9 4.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-2" />
                        <rect x="9" y="3" width="6" height="3" rx="1" />
                        <path d="m9 13.5 2 2 4-4" />
                    </NavIcon>
                ),
            },
        ],
    },
    {
        label: 'Personnel',
        items: [
            {
                to: '/admin/people',
                label: 'People',
                icon: (
                    <NavIcon>
                        <circle cx="9" cy="8" r="3.5" />
                        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
                        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
                    </NavIcon>
                ),
            },
            {
                to: '/admin/teams',
                label: 'Teams and departments',
                icon: (
                    <NavIcon>
                        <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
                        <path d="M9 8h1M14 8h1M9 12h1M14 12h1M10 20.5v-4h4v4" />
                    </NavIcon>
                ),
            },
            {
                to: '/admin/requests',
                label: 'Access requests',
                icon: (
                    <NavIcon>
                        <circle cx="10" cy="8" r="4" />
                        <path d="M3 20.5a7 7 0 0 1 11.5-5.4" />
                        <path d="M18.5 14v6M15.5 17h6" />
                    </NavIcon>
                ),
            },
        ],
    },
    {
        label: 'Communication',
        items: [
            {
                to: '/admin/memos',
                label: 'Memos',
                icon: (
                    <NavIcon>
                        <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10Z" />
                        <path d="M14 3.5v5h5M9 13h6M9 17h6" />
                    </NavIcon>
                ),
            },
            {
                to: '/admin/notifications',
                label: 'Notifications',
                icon: (
                    <NavIcon>
                        <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
                        <path d="M10 20a2 2 0 0 0 4 0" />
                    </NavIcon>
                ),
            },
            {
                to: '/admin/messages',
                label: 'Messages',
                icon: (
                    <NavIcon>
                        <path d="M20.5 12a8 8 0 0 1-11.7 7.1L3.5 20.5l1.4-5A8 8 0 1 1 20.5 12Z" />
                    </NavIcon>
                ),
            },
        ],
    },
    {
        label: 'System',
        items: [
            {
                to: '/admin/access',
                label: 'Access',
                icon: (
                    <NavIcon>
                        <circle cx="8" cy="15" r="4.5" />
                        <path d="m11.2 11.8 8.3-8.3M16.5 6.5 19 9M14 9l2 2" />
                    </NavIcon>
                ),
            },
            {
                to: '/admin/records',
                label: 'Records',
                icon: (
                    <NavIcon>
                        <rect x="3" y="4" width="18" height="4.5" rx="1" />
                        <path d="M4.5 8.5v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-10M10 12.5h4" />
                    </NavIcon>
                ),
            },
        ],
    },
];

// A small label beside an icon-only control. By default only on the icon rail (768 to 1023 px).
function Tip({ children, always = false }: { children: ReactNode; always?: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 left-full z-40 ml-3 hidden -translate-y-1/2 rounded-control bg-stone-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-raised group-hover:block group-focus-visible:block ${always ? '' : 'lg:hidden!'}`}
        >
            {children}
        </span>
    );
}

// rail: the sidebar, which turns into an icon rail below 1024 px. Otherwise the phone menu.
function AdminNav({ rail = false, onNavigate }: { rail?: boolean; onNavigate?: () => void }) {
    const id = useId();

    return (
        <nav aria-label="Admin" className="px-3 py-4">
            {groups.map((group, index) => (
                <div key={group.label} className={index > 0 ? 'mt-6' : ''}>
                    {rail && index > 0 && (
                        <hr className="mx-3 mb-4 border-white/10 lg:hidden" aria-hidden="true" />
                    )}
                    <p
                        id={`${id}-${index}`}
                        className={`px-3 pb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-white/50 uppercase ${rail ? 'hidden lg:block' : ''}`}
                    >
                        {group.label}
                    </p>
                    <ul aria-labelledby={`${id}-${index}`} className="space-y-px">
                        {group.items.map((item) => (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    end={item.end}
                                    onClick={onNavigate}
                                    className={({ isActive }) =>
                                        `group relative flex items-center gap-3 rounded-control px-3 transition-colors ${rail ? 'h-9 text-sm max-lg:h-10 max-lg:justify-center max-lg:px-0' : 'h-12 text-base'} ${isActive ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-gold-400' : 'font-medium text-white/75 hover:bg-white/[0.06] hover:text-white'}`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <span
                                                className={
                                                    isActive
                                                        ? 'text-gold-300'
                                                        : 'text-white/55 transition-colors group-hover:text-white/90'
                                                }
                                            >
                                                {item.icon}
                                            </span>
                                            <span
                                                className={`truncate ${rail ? 'max-lg:sr-only' : ''}`}
                                            >
                                                {item.label}
                                            </span>
                                            {rail && <Tip>{item.label}</Tip>}
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

const roleNames = {
    admin: 'Administrator',
    marshal: 'Marshal',
    volunteer: 'Volunteer',
    coordinator: 'Coordinator',
};

const signOutIcon = (
    <NavIcon>
        <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
        <path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" />
    </NavIcon>
);

// Who is signed in, and the sign out button. In the sidebar they share one row.
function Account({ rail = false }: { rail?: boolean }) {
    const me = useMe().data;
    const initials = me ? `${me.first_name.charAt(0)}${me.last_name.charAt(0)}`.toUpperCase() : '';

    const person = me && (
        <>
            <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-gold-200 ring-1 ring-white/15"
            >
                {initials}
            </span>
            <div className={`min-w-0 flex-1 ${rail ? 'max-lg:sr-only' : ''}`}>
                <p className="truncate text-sm font-semibold text-white">{me.name}</p>
                <p className="truncate text-xs text-white/60">
                    {me.role ? roleNames[me.role] : 'Signed in'}
                </p>
            </div>
        </>
    );

    if (!rail) {
        return (
            <div className="border-t border-white/10 px-3 py-4">
                {me && <div className="mb-2 flex items-center gap-3 px-3">{person}</div>}
                <SignOutButton className="flex h-12 w-full items-center gap-3 rounded-control px-3 text-base font-medium text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white">
                    <span className="text-white/55">{signOutIcon}</span>
                    Sign out
                </SignOutButton>
            </div>
        );
    }

    return (
        <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3 px-3 py-1 max-lg:flex-col max-lg:px-0">
                {person}
                <SignOutButton className="group relative inline-flex size-9 shrink-0 items-center justify-center rounded-control text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                    {signOutIcon}
                    <span className="sr-only">Sign out</span>
                    <Tip always>Sign out</Tip>
                </SignOutButton>
            </div>
        </div>
    );
}

// Desktop first (DESIGN_SYSTEM.md section 7): maroon-900 sidebar plus wide stone-50 content.
// From 768 to 1023 px the sidebar is an icon rail. Below 768 px it becomes a top bar with a menu.
export function AdminLayout() {
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menuOpen]);

    return (
        <div className="min-h-dvh bg-stone-50 md:flex">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-maroon-700 focus:shadow-raised"
            >
                Skip to content
            </a>

            <header className="on-dark sticky top-0 z-30 bg-maroon-900 text-white md:hidden">
                <div className="flex h-16 items-center justify-between gap-3 pr-2 pl-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <BrandLogos size="sm" className="shrink-0" />
                        <p className="truncate text-base font-bold tracking-tight">DRRMO EAMS</p>
                    </div>
                    <button
                        type="button"
                        aria-expanded={menuOpen}
                        aria-controls="admin-menu"
                        onClick={() => setMenuOpen((open) => !open)}
                        className="inline-flex size-12 shrink-0 items-center justify-center rounded-control text-white/90 transition-colors hover:bg-white/10"
                    >
                        <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
                        <NavIcon>
                            {menuOpen ? (
                                <path d="M6 6l12 12M18 6 6 18" />
                            ) : (
                                <path d="M4 7h16M4 12h16M4 17h16" />
                            )}
                        </NavIcon>
                    </button>
                </div>
                {menuOpen && (
                    <div
                        id="admin-menu"
                        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-maroon-900 shadow-raised"
                    >
                        <AdminNav onNavigate={() => setMenuOpen(false)} />
                        <Account />
                    </div>
                )}
            </header>

            <aside className="on-dark sticky top-0 hidden h-dvh w-20 shrink-0 flex-col bg-maroon-900 text-white md:flex lg:w-64">
                <div className="flex flex-col items-center border-b border-white/10 px-4 pt-6 pb-5 lg:items-start lg:px-6">
                    <BrandLogos
                        size="sm"
                        className="flex-col gap-2 lg:hidden! [&>span]:h-px [&>span]:w-6"
                    />
                    <BrandLogos size="md" className="hidden! lg:flex!" />
                    <div className="mt-4 hidden lg:block">
                        <p className="text-base leading-tight font-bold tracking-tight text-white">
                            DRRMO EAMS
                        </p>
                        <p className="mt-0.5 text-xs text-white/60">Administration</p>
                    </div>
                </div>
                <div className="flex-1 lg:overflow-y-auto">
                    <AdminNav rail />
                </div>
                <Account rail />
            </aside>

            <main
                id="main"
                tabIndex={-1}
                className="min-w-0 flex-1 px-6 py-6 outline-none lg:px-10 lg:py-8"
            >
                <Outlet />
            </main>
        </div>
    );
}

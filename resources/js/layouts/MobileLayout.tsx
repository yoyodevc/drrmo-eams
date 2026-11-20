import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation } from 'react-router';
import { listReportSlots } from '@/features/monitoring/api';
import { useOpenEmergencies } from '@/features/monitoring/hooks/useOpenEmergencies';
import { useMyUnreadMessages } from '@/features/information/messages';
import { useAlerts } from '@/features/notifications/unread';
import { EmergencyAlertBanner } from '@/features/notifications/components/EmergencyAlertBanner';
import { EmergencyOutboxNotice } from '@/features/monitoring/components/EmergencyOutboxNotice';
import { SignOutButton } from '@/app/SignOutButton';
import { BrandLink } from '@/shared/ui/BrandLink';
import { BrandLogos } from '@/shared/ui/BrandLogos';

function TabIcon({ children }: { children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-6"
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

// Five tabs, the most a 360 px phone holds with readable labels. Alerts moved to the bell in
// the top bar (DESIGN_SYSTEM.md section 7), so Reports, with the emergency button, fits in one tap.
const tabs: { to: string; label: string; icon: ReactNode; also?: string[] }[] = [
    {
        to: '/me',
        label: 'Duties',
        icon: (
            <TabIcon>
                <path d="M9 4.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="3" rx="1" />
                <path d="M9 12h6M9 16h4" />
            </TabIcon>
        ),
    },
    {
        to: '/me/reports',
        label: 'Reports',
        // A report you open keeps the Reports tab highlighted. The emergency inbox is a reviewer's page.
        also: ['/me/reports/', '/me/emergencies'],
        icon: (
            <TabIcon>
                <path d="M12 3.5 2.8 19.5h18.4Z" />
                <path d="M12 10v4.5M12 17.2v.1" />
            </TabIcon>
        ),
    },
    {
        to: '/me/messages',
        label: 'Messages',
        also: ['/me/messages/'],
        icon: (
            <TabIcon>
                <path d="M20.5 12a8 8 0 0 1-11.7 7.1L3.5 20.5l1.4-5A8 8 0 1 1 20.5 12Z" />
            </TabIcon>
        ),
    },
    {
        to: '/me/memos',
        label: 'Memos',
        // A memo you open keeps the Memos tab highlighted.
        also: ['/me/memos/'],
        icon: (
            <TabIcon>
                <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10Z" />
                <path d="M14 3.5v5h5M9 13h6M9 17h6" />
            </TabIcon>
        ),
    },
    {
        to: '/me/profile',
        label: 'Me',
        // Pages you open from the Me tab keep it highlighted.
        also: ['/me/availability'],
        icon: (
            <TabIcon>
                <circle cx="12" cy="8" r="4" />
                <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
            </TabIcon>
        ),
    },
];

function useOnline() {
    const [online, setOnline] = useState(() =>
        typeof navigator === 'undefined' ? true : navigator.onLine,
    );
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }, []);
    return online;
}

// What a tab shows on its icon's top right corner: a number in a red pill, or a plain dot.
type Badge = { count: number; label: string } | { dot: string; label: string } | null;

// Messages: how many answers wait. Reports: for the reviewer marshals, emergencies nobody has
// acknowledged yet (red pill). For a designated reporter, an ember dot while a site report is due.
function useTabBadges(): (to: string) => Badge {
    const messages = useMyUnreadMessages();
    const { waiting } = useOpenEmergencies();
    // Same query as the "reports due" card on Duties and Reports, so they share one cache.
    const slots = useQuery({
        queryKey: ['report-slots'],
        queryFn: listReportSlots,
        refetchInterval: 60_000,
    });
    const due = (slots.data ?? []).filter(
        (s) => s.status === 'pending' || s.status === 'overdue',
    ).length;

    return (to) => {
        if (to === '/me/messages' && messages > 0) {
            return { count: messages, label: `${messages} unread` };
        }
        if (to === '/me/reports') {
            if (waiting > 0) {
                return {
                    count: waiting,
                    label: `${waiting} ${waiting === 1 ? 'emergency' : 'emergencies'} not acknowledged`,
                };
            }
            if (due > 0) return { dot: 'bg-ember-600', label: 'report due' };
        }
        return null;
    };
}

function BadgeMark({ badge, pill, dot }: { badge: Badge; pill: string; dot: string }) {
    if (!badge) return null;
    if ('count' in badge) {
        return (
            <span
                className={`absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.625rem] leading-none font-bold text-white tabular-nums ring-2 ring-white ${pill}`}
                aria-hidden="true"
            >
                {badge.count > 9 ? '9+' : badge.count}
            </span>
        );
    }
    return (
        <span
            className={`absolute size-2.5 rounded-full ring-2 ring-white ${badge.dot} ${dot}`}
            aria-hidden="true"
        />
    );
}

// The bell in the top bar opens Alerts, the emails the system sent. A red dot means one came in
// since the page was last opened. Same place on phone and desktop.
function AlertsBell() {
    const { unread } = useAlerts();
    return (
        <NavLink
            to="/me/notifications"
            end
            className={({ isActive }) =>
                `relative flex size-12 shrink-0 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-maroon-100 text-maroon-700' : 'text-stone-700 hover:bg-stone-100 active:bg-stone-200'}`
            }
        >
            <TabIcon>
                <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
            </TabIcon>
            {unread && (
                <span
                    className="absolute top-3 right-3 size-2.5 rounded-full bg-red-600 ring-2 ring-white"
                    aria-hidden="true"
                />
            )}
            <span className="sr-only">Alerts{unread ? ' (new)' : ''}</span>
        </NavLink>
    );
}

// Mobile first (DESIGN_SYSTEM.md section 7): white top bar with the bell, stone-50 page, one column,
// bottom tab bar with 48 px or larger tap targets. From 768 px the tabs move into the top bar
// and the content gets a wider column, so marshals and volunteers can use a desktop too.
// On a phone, Sign out lives on the Me page. From 768 px it also sits in the top bar.
export function MobileLayout({ children }: { children?: ReactNode }) {
    const online = useOnline();
    const badge = useTabBadges();
    const { pathname } = useLocation();
    const current = (tab: (typeof tabs)[number], isActive: boolean) =>
        isActive || (tab.also ?? []).some((path) => pathname.startsWith(path));
    const hint = (to: string) => {
        const b = badge(to);
        return b ? <span className="sr-only"> ({b.label})</span> : null;
    };

    return (
        <div className="min-h-dvh bg-stone-50">
            <header className="sticky top-0 z-20 border-b border-stone-200 bg-white pt-[env(safe-area-inset-top)]">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 pr-2 pl-4 md:gap-8 md:px-10">
                    <BrandLink to="/me">
                        <BrandLogos size="sm" className="shrink-0 text-stone-900" />
                        <p className="truncate text-base font-bold tracking-tight text-stone-900">
                            DRRMO EAMS
                        </p>
                    </BrandLink>
                    <nav aria-label="Main" className="hidden h-full flex-1 md:block">
                        <ul className="flex h-full items-stretch gap-1">
                            {tabs.map((tab) => (
                                <li key={tab.to}>
                                    <NavLink
                                        to={tab.to}
                                        end
                                        className={({ isActive }) =>
                                            `flex h-full items-center gap-2 border-b-2 px-3 text-sm transition-colors [&_svg]:size-5 ${current(tab, isActive) ? 'border-maroon-700 font-semibold text-maroon-700' : 'border-transparent font-medium text-stone-600 hover:border-stone-300 hover:text-stone-900'}`
                                        }
                                    >
                                        <span className="relative">
                                            {tab.icon}
                                            <BadgeMark
                                                badge={badge(tab.to)}
                                                pill="-top-1.5 left-3"
                                                dot="-top-0.5 -right-0.5"
                                            />
                                        </span>
                                        {tab.label}
                                        {hint(tab.to)}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <div className="flex shrink-0 items-center gap-1">
                        <AlertsBell />
                        <SignOutButton className="hidden min-h-12 shrink-0 items-center rounded-control px-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 active:bg-stone-200 md:inline-flex" />
                    </div>
                </div>
                {!online && (
                    <p
                        role="status"
                        className="bg-stone-800 px-4 py-1.5 text-center text-sm text-white"
                    >
                        You're offline. Changes will be sent when you reconnect.
                    </p>
                )}
            </header>

            <main
                id="main"
                tabIndex={-1}
                className="mx-auto max-w-6xl px-6 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:px-10 md:pt-10 md:pb-16"
            >
                <EmergencyAlertBanner to="/me/emergencies" />
                <EmergencyOutboxNotice />
                {children ?? <Outlet />}
            </main>

            <nav
                aria-label="Main"
                className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
            >
                <div className="mx-auto grid max-w-2xl grid-cols-5 px-1">
                    {tabs.map((tab) => (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            end
                            className={({ isActive }) =>
                                `group flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs transition-colors ${current(tab, isActive) ? 'font-semibold text-maroon-700' : 'font-medium text-stone-600 hover:text-stone-900'}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <span
                                        className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${current(tab, isActive) ? 'bg-maroon-100' : 'group-hover:bg-stone-100'}`}
                                    >
                                        {tab.icon}
                                        <BadgeMark
                                            badge={badge(tab.to)}
                                            pill="top-0 left-1/2 ml-1"
                                            dot="top-0.5 left-1/2 ml-1"
                                        />
                                    </span>
                                    {tab.label}
                                    {hint(tab.to)}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}

// A-Reports. One place for everything the field sends in: Needs attention (the landing view),
// Emergencies and All reports. Open emergencies are never hidden: the Emergencies tab carries the
// count (red while any wait), the sidebar shows it too, and the admin layout shows the red banner.
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet } from 'react-router';
import { useMe } from '@/app/auth';
import { getAttention } from '../../api';
import { ShieldUserIcon } from '../../components/reportsUi';
import { useOpenEmergencies } from '../../hooks/useOpenEmergencies';

type Tab = {
    to: string;
    label: string;
    // A shorter label under 640 px, so all three tabs fit a phone without scrolling.
    short?: string;
    end: boolean;
    count?: number;
    urgent?: boolean;
};

export function ReportsHub() {
    const me = useMe().data;
    const { open, waiting, loaded } = useOpenEmergencies();
    // Same cache as the Needs attention tab, so the count and the list always agree.
    const attention = useQuery({
        queryKey: ['attention'],
        queryFn: getAttention,
        refetchInterval: 30_000,
    });
    const late = attention.data?.reports.length;
    const needs = attention.data ? attention.data.emergencies.length + (late ?? 0) : undefined;

    const tabs: Tab[] = [
        {
            to: '/admin/reports',
            label: 'Needs attention',
            short: 'Attention',
            end: true,
            count: needs,
        },
        {
            to: '/admin/reports/emergencies',
            label: 'Emergencies',
            end: false,
            count: loaded ? open.length : undefined,
            urgent: waiting > 0,
        },
        { to: '/admin/reports/feed', label: 'All reports', end: false },
    ];

    return (
        <div className="mx-auto max-w-[1440px]">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                <div className="min-w-0">
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Reports
                    </h1>
                    <p className="mt-1 max-w-2xl text-pretty text-stone-600">
                        Emergencies and site reports from people on duty.
                    </p>
                </div>
                {/* Under 640 px this hides; the menu has it under Access control. */}
                {me?.permissions.includes('access.manage') && (
                    <Link
                        to="/admin/access/reviewers"
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-4 text-base font-semibold text-stone-800 transition-colors hover:bg-stone-50 max-sm:hidden md:min-h-10 md:text-sm"
                    >
                        <ShieldUserIcon className="size-5 text-stone-500 md:size-4" />
                        Report reviewers
                    </Link>
                )}
            </header>

            <nav aria-label="Reports" className="mt-6 border-b border-stone-200">
                <ul className="-mb-px flex justify-between gap-4 overflow-x-auto sm:justify-start sm:gap-6">
                    {tabs.map((t) => (
                        <li key={t.to} className="shrink-0">
                            <NavLink
                                to={t.to}
                                end={t.end}
                                className={({ isActive }) =>
                                    `inline-flex min-h-12 items-center gap-2 border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${isActive ? 'border-maroon-700 text-maroon-800' : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'}`
                                }
                            >
                                {t.short ? (
                                    <>
                                        <span className="sm:hidden">{t.short}</span>
                                        <span className="max-sm:hidden">{t.label}</span>
                                    </>
                                ) : (
                                    t.label
                                )}
                                {t.count !== undefined && t.count > 0 && (
                                    <span
                                        className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${t.urgent ? 'bg-red-700 text-white' : 'bg-stone-100 text-stone-600'}`}
                                    >
                                        {t.count}
                                        <span className="sr-only">
                                            {t.urgent ? ' open, some not acknowledged' : ' open'}
                                        </span>
                                    </span>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="mt-6">
                <Outlet />
            </div>
        </div>
    );
}

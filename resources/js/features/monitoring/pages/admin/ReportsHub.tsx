// A-Reports. One place for everything the field sends in: Needs attention (the landing view),
// Emergencies and the Report feed. Unacknowledged emergencies are never hidden behind a tab: the
// Emergencies tab carries the count, and a red strip shows on the other tabs while any wait.
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useOpenEmergencies } from '../../hooks/useOpenEmergencies';

const tabs = [
    { to: '/admin/reports', label: 'Needs attention', end: true },
    { to: '/admin/reports/emergencies', label: 'Emergencies', end: false },
    { to: '/admin/reports/feed', label: 'Feed', end: false },
];

export function ReportsHub() {
    const { pathname } = useLocation();
    const { open, waiting } = useOpenEmergencies();
    const onEmergencies = pathname.startsWith('/admin/reports/emergencies');
    const onAttention = pathname === '/admin/reports' || pathname === '/admin/reports/';

    return (
        <div className="max-w-6xl">
            <header>
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    Reports
                </h1>
                <p className="mt-1 max-w-2xl text-pretty text-stone-600">
                    Emergencies and site reports from people on duty. Start with what needs
                    attention.
                </p>
            </header>

            <nav aria-label="Reports" className="mt-6 border-b border-stone-200">
                <ul className="-mb-px flex gap-1 overflow-x-auto">
                    {tabs.map((t) => {
                        const count = t.label === 'Emergencies' ? open.length : 0;
                        return (
                            <li key={t.to}>
                                <NavLink
                                    to={t.to}
                                    end={t.end}
                                    className={({ isActive }) =>
                                        `inline-flex min-h-11 items-center gap-2 border-b-2 px-2.5 text-sm sm:px-3 font-semibold whitespace-nowrap transition-colors ${isActive ? 'border-maroon-700 text-maroon-800' : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'}`
                                    }
                                >
                                    {t.label}
                                    {count > 0 && (
                                        <span
                                            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${waiting > 0 ? 'bg-red-700 text-white' : 'bg-stone-200 text-stone-700'}`}
                                        >
                                            {count}
                                            <span className="sr-only"> open</span>
                                        </span>
                                    )}
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {waiting > 0 && !onEmergencies && !onAttention && (
                <div
                    role="status"
                    className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-red-200 border-l-4 border-l-red-700 bg-red-50 px-4 py-2.5 text-red-900"
                >
                    <p className="text-sm font-medium">
                        {waiting === 1
                            ? '1 emergency is not acknowledged.'
                            : `${waiting} emergencies are not acknowledged.`}
                    </p>
                    <Link
                        to="/admin/reports/emergencies"
                        className="text-sm font-semibold text-red-800 underline underline-offset-2 hover:text-red-900"
                    >
                        Open emergencies
                    </Link>
                </div>
            )}

            <div className="mt-6">
                <Outlet />
            </div>
        </div>
    );
}

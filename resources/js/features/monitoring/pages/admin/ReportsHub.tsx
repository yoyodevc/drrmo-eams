// A-Reports. One place for everything the field sends in: Needs attention (the landing view),
// Emergencies and the Report feed. Open emergencies are never hidden: the Emergencies tab carries
// the count, and the admin layout shows the red banner on every page while any wait.
import { NavLink, Outlet } from "react-router";
import { useOpenEmergencies } from "../../hooks/useOpenEmergencies";

const tabs = [
  { to: "/admin/reports", label: "Needs attention", end: true },
  { to: "/admin/reports/emergencies", label: "Emergencies", end: false },
  { to: "/admin/reports/feed", label: "All reports", end: false },
];

export function ReportsHub() {
  const { open, waiting } = useOpenEmergencies();

  return (
    <div className="mx-auto max-w-[1440px]">
      <header className="min-w-0">
        <div
          className="brand-stripe h-1 w-12 rounded-full"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Reports
        </h1>
        <p className="mt-1 max-w-2xl text-pretty text-stone-600">
          Emergencies and site reports from people on duty. Start with what
          needs attention.
        </p>
      </header>

      <nav aria-label="Reports" className="mt-6 border-b border-stone-200">
        <ul className="-mb-px flex overflow-x-auto">
          {tabs.map((t) => {
            const count = t.label === "Emergencies" ? open.length : 0;
            return (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `inline-flex min-h-12 items-center gap-2 border-b-2 px-2.5 text-sm font-semibold sm:px-3.5 whitespace-nowrap transition-colors md:min-h-11 ${isActive ? "border-maroon-700 text-maroon-800" : "border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900"}`
                  }
                >
                  {t.label}
                  {count > 0 && (
                    <span
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${waiting > 0 ? "bg-red-700 text-white" : "bg-stone-200 text-stone-700"}`}
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

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}

// In app alerts at the top of the screen while the person has unread ones: emergencies (red), report
// reminders (amber) and missed reports (amber). Opening one marks the alerts read. The server returns
// only the person's own alerts, so this is quiet for everyone else.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { listAlerts, markAlertsRead, type InAppAlert } from '../api';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function line(a: InAppAlert, emergenciesTo: string, reportsTo: string) {
    const who = a.about ?? 'Someone on duty';
    const due = a.due_at ? clock.format(new Date(a.due_at)) : '';
    switch (a.type) {
        case 'emergency.escalated':
        case 'emergency.reminder':
            return {
                red: true,
                text: `${who}'s emergency is not acknowledged.`,
                to: emergenciesTo,
                open: 'Open emergencies',
            };
        case 'report.reminder':
            return {
                red: false,
                text: `Your site report${a.event ? ` for ${a.event}` : ''} is due at ${due}.`,
                to: `/me/reports/${a.site_report_id}`,
                open: 'Write the report',
            };
        case 'report.due':
            return {
                red: false,
                text: `Your site report${a.event ? ` for ${a.event}` : ''} is due now.`,
                to: `/me/reports/${a.site_report_id}`,
                open: 'Write the report',
            };
        case 'report.missed':
            return {
                red: false,
                text: `${who} missed a site report${a.event ? ` for ${a.event}` : ''}.`,
                to: reportsTo,
                open: 'Open the reports',
            };
        default:
            return {
                red: true,
                text: `${who} sent an emergency.`,
                to: emergenciesTo,
                open: 'Open emergencies',
            };
    }
}

// `to` is the emergency inbox of this layout. Missed reports open the report feed (admin) or the inbox.
export function EmergencyAlertBanner({ to }: { to: string }) {
    const queryClient = useQueryClient();
    const alerts = useQuery({
        queryKey: ['in-app-alerts'],
        queryFn: listAlerts,
        refetchInterval: 30_000,
    });
    const read = useMutation({
        mutationFn: markAlertsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['in-app-alerts'] }),
    });

    const unread = (alerts.data?.data ?? []).filter((a) => !a.read).slice(0, 4);
    if (unread.length === 0) return null;
    const reportsTo = to.startsWith('/admin') ? '/admin/reports' : to;

    return (
        <div className="mb-4 space-y-2">
            {unread.map((a) => {
                const l = line(a, to, reportsTo);
                return (
                    <div
                        key={a.id}
                        role="alert"
                        className={`flex items-center gap-3 rounded-control px-4 py-3 ${l.red ? 'border-l-4 border-gold-400 bg-red-700 text-white' : 'bg-amber-100 text-amber-950 ring-1 ring-amber-300'}`}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="size-6 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 8v5M12 16.5v.5M4 20h16L12 4 4 20Z" />
                        </svg>
                        <p className="min-w-0 flex-1 text-sm font-medium text-pretty">{l.text}</p>
                        <Link
                            to={l.to}
                            onClick={() => read.mutate()}
                            className={`shrink-0 rounded-control px-3 py-2 text-sm font-semibold ${l.red ? 'bg-white text-red-800 hover:bg-red-50' : 'bg-amber-950 text-white hover:bg-amber-900'}`}
                        >
                            {l.open}
                        </Link>
                    </div>
                );
            })}
        </div>
    );
}

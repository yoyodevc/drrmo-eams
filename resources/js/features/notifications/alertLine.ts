// What one in app alert says and where it leads. Used by the banner and the alarm screen.
import type { InAppAlert } from './api';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function alertLine(a: InAppAlert, emergenciesTo: string, reportsTo: string) {
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

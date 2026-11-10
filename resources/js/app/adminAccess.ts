// Which permission opens which admin screen. The sidebar, the route check and the landing page all
// read this one list, so a person who was granted a permission sees exactly the screens it opens.
// The server still decides: every endpoint checks the permission again.
import type { Me } from './auth';

export interface AdminEntry {
    to: string;
    permission: string;
}

// Order matters: it is the order a person lands on, first match wins.
export const adminEntries: AdminEntry[] = [
    { to: '/admin', permission: 'events.view_all' },
    { to: '/admin/events', permission: 'events.view_all' },
    { to: '/admin/map', permission: 'location.view' },
    { to: '/admin/reports', permission: 'reports.view' },
    { to: '/admin/people', permission: 'people.view' },
    { to: '/admin/teams', permission: 'people.view' },
    { to: '/admin/requests', permission: 'registrations.review' },
    { to: '/admin/memos', permission: 'memos.manage' },
    { to: '/admin/notifications', permission: 'notifications.view' },
    { to: '/admin/messages', permission: 'messages.office_inbox' },
    { to: '/admin/access', permission: 'access.manage' },
    { to: '/admin/records', permission: 'audit.view' },
];

export function permissionFor(path: string): string | null {
    const match = [...adminEntries]
        .sort((a, b) => b.to.length - a.to.length)
        .find((e) =>
            e.to === '/admin' ? path === '/admin' : path === e.to || path.startsWith(`${e.to}/`),
        );
    return match?.permission ?? null;
}

export function canOpen(me: Me, permission: string | null): boolean {
    return permission === null || me.permissions.includes(permission);
}

// A person who is not an admin but holds at least one admin screen through a grant.
export function hasAdminAccess(me: Me): boolean {
    return me.home === '/admin' || adminEntries.some((e) => me.permissions.includes(e.permission));
}

// The first admin screen this person may open.
export function adminLanding(me: Me): string {
    return adminEntries.find((e) => me.permissions.includes(e.permission))?.to ?? '/me';
}

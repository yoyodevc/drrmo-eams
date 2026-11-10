import { Navigate, type RouteObject } from 'react-router';
import { useMe } from '@/app/auth';
import { Dashboard } from './pages/admin/Dashboard';
import { Events } from './pages/admin/Events';
import { EventNotices } from './pages/mobile/EventNotices';
import { EventDetail } from './pages/admin/EventDetail';
import { NewEvent } from './pages/admin/NewEvent';
import { MyAssignments } from './pages/mobile/MyAssignments';

// People who do duty see their own duties. People who only read department notices, such as
// coordinators, see those instead.
function MyHome() {
    const permissions = useMe().data?.permissions ?? [];
    return !permissions.includes('assignments.own') &&
        permissions.includes('events.view_department') ? (
        <EventNotices />
    ) : (
        <MyAssignments />
    );
}

export const myDutiesRoute: RouteObject = { index: true, element: <MyHome /> };

export const dashboardRoute: RouteObject = { index: true, element: <Dashboard /> };

// Added to the admin layout in the Core router.
export const adminEventRoutes: RouteObject[] = [
    // The calendar now lives on the Events page. Old links still land there.
    { path: 'calendar', element: <Navigate to="/admin/events?show=calendar" replace /> },
    { path: 'events', element: <Events /> },
    { path: 'events/new', element: <NewEvent /> },
    { path: 'events/:id/edit', element: <NewEvent /> },
    { path: 'events/:id', element: <EventDetail /> },
];

import type { RouteObject } from 'react-router';
import { LiveMap } from './pages/admin/LiveMap';
import { ReportFeed } from './pages/admin/ReportFeed';
import { ReportReviewers } from './pages/admin/ReportReviewers';
import { EmergencyInbox } from './pages/EmergencyInbox';
import { ReportForm } from './pages/mobile/ReportForm';

// Added to the admin layout in the Core router.
export const adminMonitoringRoutes: RouteObject[] = [
    { path: 'map', element: <LiveMap /> },
    { path: 'reports', element: <ReportFeed /> },
    { path: 'emergencies', element: <EmergencyInbox /> },
    { path: 'report-reviewers', element: <ReportReviewers /> },
];

// Added to the mobile layout in the Core router.
export const myMonitoringRoutes: RouteObject[] = [
    { path: 'reports/:id', element: <ReportForm /> },
    // For the two reviewer marshals. The server checks who may read.
    { path: 'emergencies', element: <EmergencyInbox /> },
];

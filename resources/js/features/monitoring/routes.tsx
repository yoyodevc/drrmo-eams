import { Navigate, type RouteObject } from 'react-router';
import { LiveMap } from './pages/admin/LiveMap';
import { NeedsAttention } from './pages/admin/NeedsAttention';
import { ReportFeed } from './pages/admin/ReportFeed';
import { ReportReviewers } from './pages/admin/ReportReviewers';
import { ReportsHub } from './pages/admin/ReportsHub';
import { EmergencyInbox } from './pages/EmergencyInbox';
import { MyReports } from './pages/mobile/MyReports';
import { ReportForm } from './pages/mobile/ReportForm';

// Added to the admin layout in the Core router.
export const adminMonitoringRoutes: RouteObject[] = [
    { path: 'map', element: <LiveMap /> },
    {
        path: 'reports',
        element: <ReportsHub />,
        children: [
            { index: true, element: <NeedsAttention /> },
            { path: 'emergencies', element: <EmergencyInbox embedded /> },
            { path: 'feed', element: <ReportFeed /> },
        ],
    },
    // Report reviewers is a setting of who may read, so it sits with Access control.
    { path: 'access/reviewers', element: <ReportReviewers /> },
    // Older addresses, kept so saved links still work.
    { path: 'attention', element: <Navigate to="/admin/reports" replace /> },
    { path: 'emergencies', element: <Navigate to="/admin/reports/emergencies" replace /> },
    { path: 'report-reviewers', element: <Navigate to="/admin/access/reviewers" replace /> },
];

// Added to the mobile layout in the Core router.
export const myMonitoringRoutes: RouteObject[] = [
    { path: 'reports', element: <MyReports /> },
    { path: 'reports/:id', element: <ReportForm /> },
    // For the two reviewer marshals. The server checks who may read.
    { path: 'emergencies', element: <EmergencyInbox /> },
];

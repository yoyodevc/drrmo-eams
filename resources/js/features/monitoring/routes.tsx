import type { RouteObject } from 'react-router';
import { LiveMap } from './pages/admin/LiveMap';
import { ReportForm } from './pages/mobile/ReportForm';

// Added to the admin layout in the Core router.
export const adminMonitoringRoutes: RouteObject[] = [{ path: 'map', element: <LiveMap /> }];

// Added to the mobile layout in the Core router.
export const myMonitoringRoutes: RouteObject[] = [{ path: 'reports/:id', element: <ReportForm /> }];

import type { RouteObject } from 'react-router';
import { LiveMap } from './pages/admin/LiveMap';

// Added to the admin layout in the Core router.
export const adminMonitoringRoutes: RouteObject[] = [{ path: 'map', element: <LiveMap /> }];

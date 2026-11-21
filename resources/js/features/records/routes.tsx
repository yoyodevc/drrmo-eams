import type { RouteObject } from 'react-router';
import { AuditLog } from './pages/admin/AuditLog';

// Added to the admin layout in the Core router.
export const adminRecordsRoutes: RouteObject[] = [{ path: 'records', element: <AuditLog /> }];

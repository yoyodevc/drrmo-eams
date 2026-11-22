import type { RouteObject } from 'react-router';
import { NotificationLog } from './pages/admin/NotificationLog';
import { AlertSettings } from './pages/AlertSettings';
import { MyNotifications } from './pages/mobile/MyNotifications';

// Added to the admin layout in the Core router.
export const adminNotificationRoutes: RouteObject[] = [
    { path: 'notifications', element: <NotificationLog /> },
    { path: 'alert-settings', element: <AlertSettings /> },
];

// Added to the mobile layout in the Core router.
export const myNotificationRoutes: RouteObject[] = [
    { path: 'notifications', element: <MyNotifications /> },
    { path: 'alert-settings', element: <AlertSettings /> },
];

import { Navigate, type RouteObject } from 'react-router';
import { GrantsManager } from './pages/GrantsManager';
import { MyAccess } from './pages/MyAccess';
import { PermissionMatrix } from './pages/PermissionMatrix';
import { RoleDetail } from './pages/RoleDetail';
import { RolesList } from './pages/RolesList';

// Added to the admin layout in the Core router. Every screen here needs access.manage.
export const adminAccessRoutes: RouteObject[] = [
    { path: 'access', element: <Navigate to="/admin/access/roles" replace /> },
    { path: 'access/roles', element: <RolesList /> },
    { path: 'access/roles/:id', element: <RoleDetail /> },
    { path: 'access/matrix', element: <PermissionMatrix /> },
    { path: 'access/grants', element: <GrantsManager /> },
];

// Added to the phone layout.
export const myAccessRoutes: RouteObject[] = [{ path: 'access', element: <MyAccess /> }];

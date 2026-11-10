import { createBrowserRouter, Navigate } from 'react-router';
import { adminEventRoutes, dashboardRoute, myDutiesRoute } from '@/features/events/routes';
import { adminNotificationRoutes, myNotificationRoutes } from '@/features/notifications/routes';
import { AdminLayout } from '@/layouts/AdminLayout';
import { MobileLayout } from '@/layouts/MobileLayout';
import { CookieNotice } from '@/pages/CookieNotice';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { AccessRequests } from '@/features/personnel/pages/admin/AccessRequests';
import { PeopleList } from '@/features/personnel/pages/admin/PeopleList';
import { PersonForm } from '@/features/personnel/pages/admin/PersonForm';
import { PersonProfile } from '@/features/personnel/pages/admin/PersonProfile';
import { TeamsAndDepartments } from '@/features/personnel/pages/admin/TeamsAndDepartments';
import { MyAvailability } from '@/features/personnel/pages/mobile/MyAvailability';
import { MyContacts } from '@/features/personnel/pages/mobile/MyContacts';
import { MyDetails } from '@/features/personnel/pages/mobile/MyDetails';
import { MyProfile } from '@/features/personnel/pages/mobile/MyProfile';
import { Login } from '@/pages/Login';
import { PrivacyNoticePage } from '@/pages/PrivacyNoticePage';
import { RequestAccess } from '@/pages/RequestAccess';
import { VerifyEmail } from '@/pages/VerifyEmail';
import { WaitingForApproval } from '@/pages/WaitingForApproval';
import { ResetPassword } from '@/pages/ResetPassword';
import { HomeRedirect, RequireAuth } from './RequireAuth';
import { NotFound } from '@/pages/NotFound';

// Owned by Core. Modules export route objects from features/<module>/routes.tsx
// and Core adds them here in a small PR.
export const router = createBrowserRouter([
    { path: '/', element: <HomeRedirect /> },
    { path: '/login', element: <Login /> },
    { path: '/cookies', element: <CookieNotice /> },
    { path: '/privacy', element: <PrivacyNoticePage /> },
    { path: '/register', element: <RequestAccess /> },
    { path: '/register/verify', element: <VerifyEmail /> },
    { path: '/register/pending', element: <WaitingForApproval /> },
    { path: '/forgot-password', element: <ForgotPassword /> },
    { path: '/reset-password', element: <ResetPassword /> },
    {
        element: <RequireAuth area="/admin" />,
        children: [
            {
                path: '/admin',
                element: <AdminLayout />,
                children: [
                    dashboardRoute,
                    { path: 'requests', element: <AccessRequests /> },
                    { path: 'people', element: <PeopleList /> },
                    { path: 'people/new', element: <PersonForm /> },
                    { path: 'people/:id', element: <PersonProfile /> },
                    { path: 'people/:id/edit', element: <PersonForm /> },
                    { path: 'teams', element: <TeamsAndDepartments /> },
                    // Volunteer status now lives on the People list and each profile.
                    {
                        path: 'volunteers',
                        element: <Navigate to="/admin/people?role=volunteer" replace />,
                    },
                    ...adminEventRoutes,
                    ...adminNotificationRoutes,
                ],
            },
        ],
    },
    {
        element: <RequireAuth area="/me" />,
        children: [
            {
                path: '/me',
                element: <MobileLayout />,
                children: [
                    myDutiesRoute,
                    { path: 'profile', element: <MyProfile /> },
                    { path: 'availability', element: <MyAvailability /> },
                    { path: 'details', element: <MyDetails /> },
                    { path: 'contacts', element: <MyContacts /> },
                    ...myNotificationRoutes,
                ],
            },
        ],
    },
    { path: '*', element: <NotFound /> },
]);

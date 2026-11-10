// Keeps signed-out visitors on the login page and sends people to the area their role belongs to.
import { Navigate, Outlet, useLocation } from 'react-router';
import { keepLinkedAssignment, loginPathFor } from '@/features/events/dutyLink';
import { PrivacyConsent } from '@/features/records/PrivacyConsent';
import { adminLanding, hasAdminAccess } from './adminAccess';
import { useMe } from './auth';

export function RequireAuth({ area }: { area: '/admin' | '/me' }) {
    const { data: me, isPending } = useMe();
    const { search, pathname } = useLocation();

    if (isPending) return <p className="p-4 text-gray-600">Loading...</p>;
    if (!me) return <Navigate to={loginPathFor(search)} replace />;
    // A grant can open admin screens for someone whose home is the phone area, so /admin is open
    // to anyone holding an admin permission. /me stays for everyone who is not an admin.
    const allowed = area === '/admin' ? hasAdminAccess(me) : me.home === area;
    if (!allowed) return <Navigate to={keepLinkedAssignment(me.home, search)} replace />;
    if (area === '/admin' && pathname === '/admin' && me.home !== '/admin') {
        const landing = adminLanding(me);
        if (landing !== '/admin') return <Navigate to={landing} replace />;
    }

    // Nothing else is reachable until the current privacy notice is agreed to.
    if (!me.consent.privacy_notice)
        return <PrivacyConsent outdated={me.consent.privacy_notice_outdated} />;

    return <Outlet />;
}

// "/" goes to the right home once we know who the person is.
export function HomeRedirect() {
    const { data: me, isPending } = useMe();
    const { search } = useLocation();

    if (isPending) return <p className="p-4 text-gray-600">Loading...</p>;

    return (
        <Navigate to={me ? keepLinkedAssignment(me.home, search) : loginPathFor(search)} replace />
    );
}

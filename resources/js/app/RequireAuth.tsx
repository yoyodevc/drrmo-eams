// Keeps signed-out visitors on the login page and sends people to the area their role belongs to.
import { Navigate, Outlet, useLocation } from 'react-router';
import { keepLinkedAssignment, loginPathFor } from '@/features/events/dutyLink';
import { PrivacyConsent } from '@/features/records/PrivacyConsent';
import { useMe } from './auth';

export function RequireAuth({ area }: { area: '/admin' | '/me' }) {
    const { data: me, isPending } = useMe();
    const { search } = useLocation();

    if (isPending) return <p className="p-4 text-gray-600">Loading...</p>;
    if (!me) return <Navigate to={loginPathFor(search)} replace />;
    if (me.home !== area) return <Navigate to={keepLinkedAssignment(me.home, search)} replace />;

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

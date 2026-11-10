// Logo and title in a header, as a link home: admins to the dashboard, signed-in people to /me,
// signed-out visitors to the sign in page. Pass `to` when the layout already knows the target.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMe } from '@/app/auth';

export function BrandLink({
    to,
    className = '',
    children,
}: {
    to?: string;
    className?: string;
    children: ReactNode;
}) {
    const { data: me } = useMe();
    return (
        <Link
            to={to ?? me?.home ?? '/login'}
            aria-label="DRRMO EAMS home"
            className={`flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400 ${className}`}
        >
            {children}
        </Link>
    );
}

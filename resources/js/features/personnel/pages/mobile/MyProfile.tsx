// M-My profile, the "Me" tab. Who you are, then the pages about your own account.
// Mobile first at 360 px: one column, hairline list rows like Alerts. Emergency contacts (S2.3) go here too.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMe, type Me } from '@/app/auth';
import { SignOutButton } from '@/app/SignOutButton';

function Icon({ children, className = 'size-5' }: { children: ReactNode; className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

const roles: Record<NonNullable<Me['role']>, string> = {
    admin: 'Admin',
    marshal: 'Marshal',
    volunteer: 'Volunteer',
    coordinator: 'Coordinator',
};

const teams: Record<string, string> = {
    security: 'Security team',
    ert: 'ERT',
    fire_suppression: 'Fire suppression team',
};

function Row({
    to,
    icon,
    title,
    hint,
    aside,
}: {
    to: string;
    icon: ReactNode;
    title: string;
    hint: string;
    aside?: ReactNode;
}) {
    return (
        <li>
            <Link
                to={to}
                className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50 active:bg-stone-100"
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                    {icon}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-stone-900">{title}</span>
                    <span className="block text-sm text-pretty text-stone-600">{hint}</span>
                </span>
                {aside}
                <Icon className="size-5 shrink-0 text-stone-400">
                    <path d="m9 6 6 6-6 6" />
                </Icon>
            </Link>
        </li>
    );
}

function Skeleton() {
    return (
        <div aria-busy="true">
            <p role="status" className="sr-only">
                Loading your profile...
            </p>
            <div aria-hidden="true">
                <div className="h-7 w-48 animate-pulse rounded bg-stone-200" />
                <div className="mt-3 h-4 w-40 animate-pulse rounded bg-stone-200" />
                <div className="mt-2 h-4 w-56 animate-pulse rounded bg-stone-200" />
            </div>
        </div>
    );
}

export function MyProfile() {
    const me = useMe().data;
    const active = me?.status !== 'inactive';
    const about = me ? [me.role ? roles[me.role] : null, me.team ? teams[me.team] : null] : [];

    return (
        <div className="mx-auto max-w-2xl">
            <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
            <div className="mt-4">
                {me ? (
                    <>
                        <h1 className="text-2xl font-semibold tracking-tight text-balance text-stone-900">
                            {me.name}
                        </h1>
                        {about.some(Boolean) && (
                            <p className="mt-1 text-base text-stone-700">
                                {about.filter(Boolean).join(', ')}
                            </p>
                        )}
                        <p className="mt-0.5 text-sm break-all text-stone-500">{me.email}</p>
                    </>
                ) : (
                    <Skeleton />
                )}
            </div>

            <section aria-labelledby="me-account" className="mt-8">
                <h2
                    id="me-account"
                    className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase"
                >
                    Your account
                </h2>
                <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                    <Row
                        to="/me/availability"
                        title="My availability"
                        hint={
                            active
                                ? 'You can be assigned to duties.'
                                : 'You are not offered for duty right now.'
                        }
                        icon={
                            <Icon>
                                <rect x="4" y="5" width="16" height="15" rx="2" />
                                <path d="M8 3v4M16 3v4M4 10h16M9.5 15l2 2 3.5-3.5" />
                            </Icon>
                        }
                        aside={
                            me && (
                                <span
                                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${active ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-stone-100 text-stone-600 ring-stone-200'}`}
                                >
                                    {active ? 'Active' : 'Inactive'}
                                </span>
                            )
                        }
                    />
                    <Row
                        to="/privacy"
                        title="Privacy notice"
                        hint="What DRRMO keeps about you and why."
                        icon={
                            <Icon>
                                <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
                                <path d="m9.5 12 1.8 1.8 3.2-3.3" />
                            </Icon>
                        }
                    />
                </ul>
            </section>

            <SignOutButton className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-5 text-base font-semibold text-stone-800 transition-colors hover:bg-stone-50 active:bg-stone-100">
                <Icon>
                    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
                </Icon>
                Sign out
            </SignOutButton>
        </div>
    );
}

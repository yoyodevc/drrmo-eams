// Cookie notice (M-Cookie notice in SCREENS.md). Public page in plain, short sentences.
// A plain document layout, not AuthLayout: this page is for reading, and signed in people open it too.
// The cookie names and lifetimes below must match the server settings (config/jwt.php and
// config/session.php). tests/Feature/Core/CookieNoticeTest.php checks that they do.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandLink } from '@/shared/ui/BrandLink';
import { BrandLogos } from '@/shared/ui/BrandLogos';

interface CookieInfo {
    name: string;
    purpose: string;
    lifetime: string;
    setWhen: string;
}

const cookies: CookieInfo[] = [
    {
        name: 'drrmo_access',
        purpose: 'Shows the system that you are signed in. Page scripts cannot read it.',
        lifetime: '15 minutes',
        setWhen: 'You sign in',
    },
    {
        name: 'drrmo_refresh',
        purpose:
            'Renews your sign in so you do not retype your password every 15 minutes. It is replaced each time it is used.',
        lifetime: '7 days',
        setWhen: 'You sign in',
    },
    {
        name: 'drrmo-eams-session',
        purpose: 'A technical cookie from the web framework. It does not sign you in.',
        lifetime: '8 hours',
        setWhen: 'You open the site',
    },
    {
        name: 'XSRF-TOKEN',
        purpose: 'Helps stop other sites from sending requests in your name.',
        lifetime: '8 hours',
        setWhen: 'You open the site',
    },
];

const year = new Date().getFullYear();

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mt-10">
            <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
            <div className="mt-2 space-y-3 leading-relaxed text-pretty text-stone-700">
                {children}
            </div>
        </section>
    );
}

// On phones each row becomes a small stacked card, so the table never scrolls sideways.
// The labels inside the cells only show there; on wider screens the table header does the job.
function CellLabel({ children }: { children: ReactNode }) {
    return (
        <span className="block text-xs font-semibold tracking-wide text-stone-500 uppercase sm:hidden">
            {children}
        </span>
    );
}

function CookieTable() {
    return (
        <div className="mt-4 overflow-hidden rounded-card ring-1 ring-stone-200">
            <table className="w-full text-left text-sm max-sm:block">
                <thead className="bg-stone-50 text-xs font-semibold tracking-wide text-stone-500 uppercase max-sm:sr-only">
                    <tr>
                        <th scope="col" className="px-4 py-3">
                            Cookie
                        </th>
                        <th scope="col" className="px-4 py-3">
                            What it does
                        </th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">
                            Kept for
                        </th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">
                            Set when
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 max-sm:block">
                    {cookies.map((cookie) => (
                        <tr
                            key={cookie.name}
                            className="align-top max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-3 max-sm:p-4"
                        >
                            <th
                                scope="row"
                                className="px-4 py-3 font-mono text-[0.8125rem] font-semibold break-all text-stone-900 max-sm:col-span-2 max-sm:p-0 sm:whitespace-nowrap"
                            >
                                {cookie.name}
                            </th>
                            <td className="px-4 py-3 text-stone-700 max-sm:col-span-2 max-sm:p-0">
                                <CellLabel>What it does</CellLabel>
                                <span className="block">{cookie.purpose}</span>
                            </td>
                            <td className="px-4 py-3 text-stone-700 max-sm:p-0 sm:whitespace-nowrap">
                                <CellLabel>Kept for</CellLabel>
                                <span className="block">{cookie.lifetime}</span>
                            </td>
                            <td className="px-4 py-3 text-stone-700 max-sm:p-0 sm:whitespace-nowrap">
                                <CellLabel>Set when</CellLabel>
                                <span className="block">{cookie.setWhen}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function CookieNotice() {
    return (
        <div className="min-h-dvh bg-white">
            <header className="border-b border-stone-200">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
                    <BrandLink>
                        <BrandLogos size="sm" className="shrink-0 text-stone-900" />
                        <span className="hidden text-sm font-semibold text-stone-900 sm:inline">
                            DRRMO EAMS
                        </span>
                    </BrandLink>
                    <Link
                        to="/login"
                        className="flex min-h-12 items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="size-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Back to sign in
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
                <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-maroon-700 uppercase">
                    <span className="brand-stripe h-1 w-8 rounded-full" aria-hidden="true" />
                    Privacy
                </p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
                    Cookie notice
                </h1>
                <p className="mt-2 text-sm text-stone-500">Last updated 6 November 2026</p>
                <p className="mt-6 leading-relaxed text-pretty text-stone-700">
                    This system uses a small number of cookies. They keep you signed in and protect
                    your account. We do not use cookies for tracking, advertising or analytics, and
                    we do not share them with anyone.
                </p>

                <Section title="The cookies we set">
                    <p>All four are set by this system only. None come from other companies.</p>
                    <CookieTable />
                </Section>

                <Section title="There is no cookie choice">
                    <p>
                        All of these cookies are essential. The system does not work without them,
                        and you cannot sign in if your browser blocks them.
                    </p>
                    <p>
                        There are no optional cookies, so there is nothing to switch on or off. That
                        is why the cookie message only has a Got it button.
                    </p>
                </Section>

                <Section title="What else your browser keeps">
                    <p>
                        When you press Got it, your browser remembers it in local storage. This is
                        not a cookie. It holds one word and no personal data. If you clear the site
                        data, the message shows again.
                    </p>
                </Section>

                <Section title="How to remove them">
                    <p>
                        Signing out deletes the two sign in cookies. You can also clear all cookies
                        for this site in your browser settings at any time.
                    </p>
                </Section>

                <Section title="Your information">
                    <p>
                        The Data Privacy Act of 2012 (RA 10173) protects the information we keep
                        about you. For questions about your data, contact the ZPPSU Disaster Risk
                        Reduction and Management Office in Zamboanga City.
                    </p>
                </Section>

                <p className="mt-14 border-t border-stone-200 pt-5 text-xs text-stone-500">
                    © {year} ZPPSU DRRMO · Zamboanga City
                </p>
            </main>
        </div>
    );
}

// Shared frame for the signed-out screens: sign in, forgot password, reset password.
// Phone first: brand header, then a white sheet with the form. On wide screens it splits into
// a brand panel on the left and the form on the right. See M-Login in docs/SCREENS.md.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandLogos } from '@/shared/ui/BrandLogos';
import { CookieBanner } from '@/shared/ui/CookieBanner';

const highlights: { title: string; text: string; icon: ReactNode }[] = [
    {
        title: 'Know your duty',
        text: 'Assignments reach you by email and show up on your phone.',
        icon: (
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 10 2 2 4-4" />
        ),
    },
    {
        title: 'Check in on site',
        text: 'Acknowledge and start duty with one tap.',
        icon: (
            <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        ),
    },
    {
        title: 'Keep DRRMO informed',
        text: 'Send site reports so every event stays safe.',
        icon: <path d="M4 4h16v12H8l-4 4V4Zm4 5h8M8 12h5" />,
    },
];

const year = new Date().getFullYear();

function BrandPanel() {
    return (
        <section
            aria-label="About the system"
            className="on-dark relative isolate overflow-hidden bg-maroon-900 text-white lg:sticky lg:top-0 lg:min-h-dvh lg:self-start"
        >
            {/* Background: a quiet maroon gradient with the ZPPSU gear as a faint watermark on desktop. */}
            <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[radial-gradient(100%_60%_at_100%_0%,rgb(242_184_42/0.10),transparent_60%),linear-gradient(165deg,var(--color-maroon-800),var(--color-maroon-950))]"
            />
            <img
                src="/images/brand/zppsu-logo.webp"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -right-28 -bottom-28 -z-10 hidden w-[560px] opacity-[0.05] grayscale lg:block"
            />

            <div className="mx-auto flex h-full max-w-xl flex-col lg:min-h-dvh px-6 pt-8 pb-14 sm:px-10 lg:max-w-none lg:px-14 lg:py-10 xl:px-20">
                <header className="flex items-center gap-4">
                    <BrandLogos
                        size="md"
                        className="shrink-0 text-white [&_img]:drop-shadow-[0_2px_6px_rgb(0_0_0/0.3)] lg:[&_img]:size-16"
                    />
                    <div className="min-w-0 leading-tight">
                        <p className="text-[0.8125rem] text-white/80">
                            Zamboanga Peninsula Polytechnic State University
                        </p>
                        <p className="mt-0.5 text-[0.8125rem] font-semibold text-gold-300">
                            Disaster Risk Reduction and Management Office
                        </p>
                    </div>
                </header>

                <div className="mt-8 lg:my-auto lg:max-w-xl lg:py-8">
                    <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">
                        <span className="h-px w-8 bg-gold-400" aria-hidden="true" />
                        DRRMO EAMS
                    </p>
                    <h2 className="mt-4 text-[1.625rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.5rem] lg:leading-[1.1] xl:text-[2.75rem]">
                        Personnel Event Assignment and Monitoring System
                    </h2>
                    <p className="mt-4 hidden max-w-md text-lg leading-relaxed text-pretty text-white/75 sm:block">
                        One place to plan campus events, assign marshals and volunteers, and follow
                        every duty from start to end.
                    </p>

                    <ul className="mt-8 hidden max-w-md divide-y divide-white/10 border-y border-white/10 lg:block">
                        {highlights.map((item) => (
                            <li key={item.title} className="flex gap-4 py-3.5">
                                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-gold-300 ring-1 ring-white/15">
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="size-5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        {item.icon}
                                    </svg>
                                </span>
                                <span>
                                    <span className="block font-medium">{item.title}</span>
                                    <span className="block text-[0.9375rem] text-pretty text-white/65">
                                        {item.text}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="hidden text-sm text-white/50 lg:block">
                    © {year} ZPPSU DRRMO · Zamboanga City
                </p>
            </div>
        </section>
    );
}

export function AuthLayout({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: ReactNode;
    children: ReactNode;
}) {
    return (
        <>
            <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <BrandPanel />

                <main
                    tabIndex={-1}
                    className="relative -mt-5 outline-none rounded-t-[1.25rem] bg-white px-6 pt-8 pb-10 sm:px-10 lg:mt-0 lg:flex lg:flex-col lg:rounded-none lg:px-14 lg:py-12"
                >
                    <div className="mx-auto w-full max-w-sm sm:max-w-xl lg:my-auto lg:max-w-sm">
                        <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-[1.75rem]">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="mt-1.5 text-pretty text-stone-600">{subtitle}</p>
                        )}

                        {children}

                        <div className="mt-10 flex gap-3 border-t border-stone-200 pt-5 text-[0.8125rem] leading-relaxed text-stone-500">
                            <svg
                                viewBox="0 0 24 24"
                                className="mt-0.5 size-4 shrink-0 text-stone-400"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
                                <path d="m9 12 2 2 4-4" />
                            </svg>
                            <p>
                                Your information is protected under the Data Privacy Act of 2012 (RA
                                10173). Location is only shared while you are on duty.
                            </p>
                        </div>
                        <p className="mt-3 flex gap-4 pl-7 text-[0.8125rem]">
                            <Link
                                to="/privacy"
                                className="text-stone-500 underline underline-offset-2 hover:text-stone-700"
                            >
                                Privacy notice
                            </Link>
                            <Link
                                to="/cookies"
                                className="text-stone-500 underline underline-offset-2 hover:text-stone-700"
                            >
                                Cookie notice
                            </Link>
                        </p>
                    </div>

                    <p className="mt-10 text-center text-xs text-stone-500 lg:hidden">
                        © {year} ZPPSU DRRMO · Zamboanga City
                    </p>
                </main>
            </div>
            <CookieBanner />
        </>
    );
}

// Plain text link back to another signed-out screen.
export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link to={to} className="font-medium text-maroon-700 hover:underline">
            {children}
        </Link>
    );
}

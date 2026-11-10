// The privacy notice text (M-Privacy notice and consent in docs/SCREENS.md).
// One source for the words: the consent screen and the public /privacy page both render it.
// NOTICE_VERSION must match config/privacy.php. Change both, and the date, when the text changes,
// so everyone is asked to agree again on their next sign in.
import type { ReactNode } from 'react';

export const NOTICE_VERSION = '2026-11-v1';
export const NOTICE_UPDATED = '10 November 2026';

function Icon({ children }: { children: ReactNode }) {
    return (
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-maroon-700 ring-1 ring-stone-200">
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
                {children}
            </svg>
        </span>
    );
}

const summary: { title: string; text: string; icon: ReactNode }[] = [
    {
        title: 'What we keep',
        text: 'Your name, email, contact number, emergency contacts and your duty records.',
        icon: <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0" />,
    },
    {
        title: 'Why we keep it',
        text: 'To assign duties and keep people safe at campus events. Never to grade or discipline you.',
        icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    },
    {
        title: 'Your location',
        text: 'Shared only while you are on duty, and deleted after 10 working days.',
        icon: (
            <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        ),
    },
    {
        title: 'Who sees it',
        text: 'DRRMO staff who need it for their work. Only DRRMO admins see where you are.',
        icon: (
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        ),
    },
    {
        title: 'Your rights',
        text: 'You can see, download and correct your data, and stop sharing your location.',
        icon: <path d="m9 11 3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />,
    },
];

const retention: [string, string][] = [
    ['Location while on duty', '10 working days'],
    ['Site report photos', '1 year'],
    ['Email log', '6 months'],
    ['Activity log', '3 years'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mt-10">
            <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
            <div className="mt-2 space-y-3 leading-relaxed text-pretty text-stone-700">
                {children}
            </div>
        </section>
    );
}

function Bullets({ items }: { items: ReactNode[] }) {
    return (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-stone-400">
            {items.map((item, i) => (
                <li key={i}>{item}</li>
            ))}
        </ul>
    );
}

export function PrivacyNoticeBody() {
    return (
        <>
            <section aria-labelledby="notice-summary" className="mt-8">
                <h2 id="notice-summary" className="text-lg font-semibold text-stone-900">
                    The short version
                </h2>
                <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                    {summary.map((item) => (
                        <li key={item.title} className="flex gap-4 py-4">
                            <Icon>{item.icon}</Icon>
                            <span>
                                <span className="block font-medium text-stone-900">
                                    {item.title}
                                </span>
                                <span className="mt-0.5 block text-[0.9375rem] leading-relaxed text-pretty text-stone-600">
                                    {item.text}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="notice-full" className="mt-12">
                <h2 id="notice-full" className="text-lg font-semibold text-stone-900">
                    The full notice
                </h2>
                <p className="mt-1 text-sm text-stone-500">The same points, in more detail.</p>

                <Section title="Who we are">
                    <p>
                        DRRMO EAMS is run by the Disaster Risk Reduction and Management Office of
                        Zamboanga Peninsula Polytechnic State University (ZPPSU) in Zamboanga City.
                        The office decides how your information is used and is responsible for it
                        under the Data Privacy Act of 2012 (RA 10173).
                    </p>
                </Section>

                <Section title="What we collect">
                    <Bullets
                        items={[
                            'Your name, email, role, team and department.',
                            'Your contact number and the emergency contacts you add.',
                            'Your duties: which events you are assigned to, when you acknowledge, start and end duty, and whether you showed up.',
                            'Your location, only while you are on duty.',
                            'Site reports and photos, if DRRMO asks you to send them.',
                            'Messages you send to the office.',
                            'Sign in records: when you sign in and from which internet address. We use these to protect your account.',
                        ]}
                    />
                    <p>
                        We do not collect your birthday, home address, ID numbers or photos of you.
                    </p>
                </Section>

                <Section title="Why we use it">
                    <p>
                        We use your information to plan campus events, assign marshals and
                        volunteers, tell you about your duties, and respond quickly if something
                        happens during an event.
                    </p>
                    <p>
                        We do not use it to grade you, rate your performance or discipline you. We
                        do not sell it or use it for advertising.
                    </p>
                </Section>

                <Section title="Your location during duty">
                    <p>
                        When you tap Start duty, the system asks you separately before it shares
                        your location. After you agree, your phone sends your position about every
                        30 seconds until you end duty. Nothing is sent before or after your shift.
                    </p>
                    <p>
                        Only DRRMO admins can see the map, plus a person they give access to for one
                        event day at most. Every time someone opens the map or your trail, it is
                        recorded.
                    </p>
                </Section>

                <Section title="Who can see it">
                    <Bullets
                        items={[
                            'DRRMO admins can see everything listed above.',
                            'Coordinators see event notices for their department. They do not see your location.',
                            'Other marshals and volunteers do not see your contact details or location.',
                            'We do not share your information outside ZPPSU unless the law requires it.',
                        ]}
                    />
                </Section>

                <Section title="How long we keep it">
                    <dl className="divide-y divide-stone-200 border-y border-stone-200 text-[0.9375rem]">
                        {retention.map(([what, howLong]) => (
                            <div
                                key={what}
                                className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5"
                            >
                                <dt className="text-stone-700">{what}</dt>
                                <dd className="font-medium text-stone-900">{howLong}</dd>
                            </div>
                        ))}
                    </dl>
                    <p>
                        After that, the system deletes it on its own. DRRMO reviews accounts that
                        are no longer used once a year.
                    </p>
                </Section>

                <Section title="How we protect it">
                    <p>
                        The system only works over a secure connection. Passwords are stored in a
                        form nobody can read back. Files are kept in private storage, and each
                        person only sees what their role allows.
                    </p>
                </Section>

                <Section title="Your rights">
                    <Bullets
                        items={[
                            'See the information we keep about you, and download a copy from your profile.',
                            'Correct your contact number and emergency contacts yourself. Ask DRRMO to fix anything else.',
                            'Stop sharing your location at any time from your profile. You then cannot start duty, and DRRMO is told so they can assign someone else.',
                            'Complain to the National Privacy Commission if you think we misused your information.',
                        ]}
                    />
                </Section>

                <Section title="Questions">
                    <p>
                        Ask the ZPPSU Disaster Risk Reduction and Management Office, Zamboanga City,
                        or send a message to DRRMO from inside the system.
                    </p>
                </Section>

                <Section title="Changes to this notice">
                    <p>
                        If we change this notice, we will ask you to read it and agree again the
                        next time you sign in.
                    </p>
                </Section>
            </section>
        </>
    );
}

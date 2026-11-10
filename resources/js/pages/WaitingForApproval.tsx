// Waiting for approval (M-Waiting in SCREENS.md). Shown after the email is confirmed.
// Says what happens next, as a short list of points split by hairlines (DESIGN_SYSTEM.md section 1).
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AuthLayout } from '@/app/AuthLayout';
import { RequestSteps } from '@/features/personnel/components/RequestSteps';
import { Alert } from '@/shared/ui/Alert';

const next: { title: string; text: string; icon: ReactNode }[] = [
    {
        title: 'The DRRMO office checks your request',
        text: 'An admin looks at your name and email and approves the request.',
        icon: (
            <>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
            </>
        ),
    },
    {
        title: 'You get an email',
        text: 'We tell you when it is approved, or if it cannot be approved and why.',
        icon: (
            <>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3.5 6.5 8.5 6 8.5-6" />
            </>
        ),
    },
    {
        title: 'Then sign in',
        text: 'Use the email and password you just made. Until then you cannot sign in.',
        icon: <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" />,
    },
];

export function WaitingForApproval() {
    return (
        <AuthLayout title="Waiting for approval">
            <RequestSteps current={3} />

            <div className="mt-7">
                <Alert tone="success">Your email is confirmed. Your request is sent.</Alert>
            </div>

            <h2 className="mt-7 text-sm font-semibold text-stone-900">What happens next</h2>
            <ol className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
                {next.map((item) => (
                    <li key={item.title} className="flex gap-3.5 py-3.5">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
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
                            <span className="block font-medium text-stone-900">{item.title}</span>
                            <span className="block text-sm text-pretty text-stone-600">
                                {item.text}
                            </span>
                        </span>
                    </li>
                ))}
            </ol>

            <Link
                to="/login"
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-control border border-stone-300 bg-white px-5 font-semibold text-stone-800 transition-colors hover:bg-stone-50 active:bg-stone-100"
            >
                Back to sign in
            </Link>
        </AuthLayout>
    );
}

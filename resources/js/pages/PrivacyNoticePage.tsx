// The public privacy notice. Anyone can read it, signed in or not, so the "Request access"
// checkbox and the sign in page can link to it. Same frame as the cookie notice.
import { Link } from 'react-router';
import { useMe } from '@/app/auth';
import { BackLink } from '@/features/personnel/components/ui';
import {
    PrivacyNoticeBody,
    NOTICE_UPDATED,
    NOTICE_VERSION,
} from '@/features/records/PrivacyNotice';
import { MobileLayout } from '@/layouts/MobileLayout';
import { BrandLink } from '@/shared/ui/BrandLink';
import { BrandLogos } from '@/shared/ui/BrandLogos';

export function PrivacyNoticePage() {
    const { data: me } = useMe();

    // Signed in on the phone side: same shell as /me/access.
    if (me?.home === '/me') {
        return (
            <MobileLayout>
                <div className="mx-auto max-w-2xl">
                    <BackLink to="/me/profile">Me</BackLink>
                    <div className="brand-stripe mt-2 h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Privacy notice
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">
                        Updated {NOTICE_UPDATED} · Version {NOTICE_VERSION}
                    </p>
                    <PrivacyNoticeBody />
                </div>
            </MobileLayout>
        );
    }

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
                    {!me && (
                        <Link
                            to="/login"
                            className="flex min-h-12 items-center text-sm font-medium text-maroon-700 hover:underline"
                        >
                            Back to sign in
                        </Link>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
                {me && (
                    <div className="mb-4">
                        <BackLink to="/me/profile">Me</BackLink>
                    </div>
                )}
                <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
                    Privacy notice
                </h1>
                <p className="mt-2 text-sm text-stone-500">
                    Updated {NOTICE_UPDATED} · Version {NOTICE_VERSION}
                </p>
                <PrivacyNoticeBody />
            </main>
        </div>
    );
}

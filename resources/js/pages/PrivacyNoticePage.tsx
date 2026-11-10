// The public privacy notice. Anyone can read it, signed in or not, so the "Request access"
// checkbox and the sign in page can link to it. Same frame as the cookie notice.
import { Link } from 'react-router';
import {
    PrivacyNoticeBody,
    NOTICE_UPDATED,
    NOTICE_VERSION,
} from '@/features/records/PrivacyNotice';
import { BrandLogos } from '@/shared/ui/BrandLogos';

export function PrivacyNoticePage() {
    return (
        <div className="min-h-dvh bg-white">
            <header className="border-b border-stone-200">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <BrandLogos size="sm" className="shrink-0 text-stone-900" />
                        <span className="hidden text-sm font-semibold text-stone-900 sm:inline">
                            DRRMO EAMS
                        </span>
                    </div>
                    <Link
                        to="/login"
                        className="flex min-h-12 items-center text-sm font-medium text-maroon-700 hover:underline"
                    >
                        Back to sign in
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
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

// Privacy notice and consent (S2.5, M-Privacy notice and consent in docs/SCREENS.md).
// Shown after sign in when the person has not agreed to the current notice version. It blocks the
// app: no navigation, only the notice, Sign out, and one "I have read and agree" button that stays
// fixed at the bottom of the screen. Same reading layout as the cookie notice.
//
// This file is the design reference. PrivacyConsentView is the look; the build wires it to the
// consent API and to useMe() (see design-specs/privacy-consent.md).
import { useEffect, useRef, type ReactNode } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { BrandLink } from '@/shared/ui/BrandLink';
import { BrandLogos } from '@/shared/ui/BrandLogos';
import { Button } from '@/shared/ui/Button';
import {
    NOTICE_UPDATED,
    NOTICE_VERSION,
    PrivacyNoticeBody,
} from '@/features/records/PrivacyNotice';

export interface PrivacyConsentViewProps {
    // True when the person agreed to an older version, so we tell them it changed.
    updated: boolean;
    saving: boolean;
    error: string | null;
    offline: boolean;
    onAgree: () => void;
    // The sign out control, so this view does not depend on the auth hooks.
    signOut: ReactNode;
}

export function PrivacyConsentView({
    updated,
    saving,
    error,
    offline,
    onAgree,
    signOut,
}: PrivacyConsentViewProps) {
    const heading = useRef<HTMLHeadingElement>(null);

    // Start screen readers and keyboards at the title, not at the agree button.
    useEffect(() => heading.current?.focus(), []);

    return (
        <div className="min-h-dvh bg-white">
            {offline && (
                <p className="bg-stone-800 px-6 py-2 text-center text-sm text-white">
                    You're offline. You can keep reading, but agreeing needs a connection.
                </p>
            )}

            <header className="border-b border-stone-200">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
                    <BrandLink>
                        <BrandLogos size="sm" className="shrink-0 text-stone-900" />
                        <span className="hidden text-sm font-semibold text-stone-900 sm:inline">
                            DRRMO EAMS
                        </span>
                    </BrandLink>
                    {signOut}
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-6 pt-8 pb-12 sm:pt-14">
                <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-maroon-700 uppercase">
                    <span className="brand-stripe h-1 w-8 rounded-full" aria-hidden="true" />
                    Data privacy
                </p>
                <h1
                    ref={heading}
                    tabIndex={-1}
                    className="mt-4 text-3xl font-semibold tracking-tight text-balance text-stone-900 focus:outline-none"
                >
                    Privacy notice
                </h1>
                <p className="mt-3 leading-relaxed text-pretty text-stone-700">
                    Before you use DRRMO EAMS, read how we use your information. You need to agree
                    to continue.
                </p>
                <p className="mt-2 text-sm text-stone-500">
                    Updated {NOTICE_UPDATED} · Version {NOTICE_VERSION}
                </p>

                {updated && (
                    <div className="mt-6">
                        <Alert tone="info">
                            We changed this notice on {NOTICE_UPDATED}. Read it again and agree to
                            keep using the system.
                        </Alert>
                    </div>
                )}

                <PrivacyNoticeBody />
            </main>

            {/* Fixed action bar. It floats over the page, so it gets the raised shadow. */}
            <div className="sticky bottom-0 border-t border-stone-200 bg-white shadow-raised">
                <div className="mx-auto max-w-2xl px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {error && (
                        <div className="mb-3">
                            <Alert tone="error">{error}</Alert>
                        </div>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                        <p className="text-sm text-pretty text-stone-600">
                            By agreeing, you confirm you have read this notice.
                        </p>
                        <Button
                            block
                            loading={saving}
                            onClick={onAgree}
                            className="sm:w-auto sm:shrink-0"
                        >
                            {saving ? 'Saving...' : 'I have read and agree'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

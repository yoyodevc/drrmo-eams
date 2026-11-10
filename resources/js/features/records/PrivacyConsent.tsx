// Feeds PrivacyConsentView. RequireAuth shows this instead of the app while the privacy notice
// has not been agreed to. After agreeing, /api/me is read again and the app appears.
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { endSession } from '@/app/auth';
import { SignOutButton } from '@/app/SignOutButton';
import { PrivacyConsentView } from '@/pages/PrivacyConsent';
import { agreeToPrivacyNotice } from './api';

function useOnline(): boolean {
    const [online, setOnline] = useState(() => navigator.onLine);

    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => {
            window.removeEventListener('online', on);
            window.removeEventListener('offline', off);
        };
    }, []);

    return online;
}

export function PrivacyConsent({ outdated }: { outdated: boolean }) {
    const queryClient = useQueryClient();
    const online = useOnline();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function agree() {
        if (saving) return;
        setError(null);
        setSaving(true);
        try {
            await agreeToPrivacyNotice();
            await queryClient.invalidateQueries({ queryKey: ['me'] });
        } catch (e) {
            // 401 or 419 means the session is gone: the route guards then show the login page.
            if (e instanceof ApiError && (e.status === 401 || e.status === 419)) {
                endSession(queryClient);
                return;
            }
            setError('Could not save your answer. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <PrivacyConsentView
            updated={outdated}
            saving={saving}
            error={error}
            offline={!online}
            onAgree={() => void agree()}
            signOut={
                <SignOutButton className="flex min-h-12 items-center text-sm font-medium text-maroon-700 hover:underline" />
            }
        />
    );
}

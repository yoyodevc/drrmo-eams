// Calls the Records endpoint for the privacy notice. Needs a signed-in person.
import { api } from '@/shared/api/client';

export async function agreeToPrivacyNotice(): Promise<void> {
    await api('/api/consent/privacy-notice', { method: 'POST' });
}

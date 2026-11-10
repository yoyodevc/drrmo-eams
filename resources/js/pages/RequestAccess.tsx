// Request access (M-Request access in SCREENS.md). Public sign up for volunteers.
// The account stays pending until the email is confirmed and an admin approves it.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthLayout, AuthLink } from '@/app/AuthLayout';
import { requestAccess } from '@/features/personnel/registration';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { PasswordField } from '@/shared/ui/PasswordField';
import { TextField } from '@/shared/ui/TextField';

const MIN_LENGTH = 12;

interface ValidationBody {
    errors?: Record<string, string[]>;
}

function fieldErrors(error: unknown): Record<string, string> {
    if (!(error instanceof ApiError) || error.status !== 422) return {};
    const errors = (error.body as ValidationBody | null)?.errors ?? {};
    return Object.fromEntries(Object.entries(errors).map(([key, list]) => [key, list[0] ?? '']));
}

export function RequestAccess() {
    const navigate = useNavigate();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [consent, setConsent] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setFormError(null);
        const local: Record<string, string> = {};
        if (firstName.trim() === '') local.first_name = 'Enter your first name.';
        if (lastName.trim() === '') local.last_name = 'Enter your last name.';
        if (!/^\S+@\S+\.\S+$/.test(email)) local.email = 'Enter a valid email address.';
        if (password.length < MIN_LENGTH) local.password = `Use at least ${MIN_LENGTH} characters.`;
        else if (password !== confirmation) local.password_confirmation = 'The passwords differ.';
        if (!consent) local.privacy_consent = 'You need to agree to continue.';
        setErrors(local);
        if (Object.keys(local).length > 0) return;

        setBusy(true);
        try {
            await requestAccess({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email,
                password,
                password_confirmation: confirmation,
                privacy_consent: consent,
            });
            await navigate(`/register/verify?email=${encodeURIComponent(email)}`);
        } catch (caught) {
            const server = fieldErrors(caught);
            setErrors(server);
            if (Object.keys(server).length === 0) {
                setFormError(
                    caught instanceof ApiError && caught.status === 429
                        ? 'Too many requests. Wait a while and try again.'
                        : 'Something went wrong. Check your connection and try again.',
                );
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthLayout
            title="Request access"
            subtitle="For volunteers. The DRRMO office approves every request before you can sign in."
        >
            <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
                <TextField
                    label="First name"
                    autoComplete="given-name"
                    maxLength={100}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    error={errors.first_name}
                    required
                />
                <TextField
                    label="Last name"
                    autoComplete="family-name"
                    maxLength={100}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    error={errors.last_name}
                    required
                />
                <TextField
                    label="Email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    required
                />
                <PasswordField
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    hint={`At least ${MIN_LENGTH} characters.`}
                    error={errors.password}
                    required
                />
                <PasswordField
                    label="Confirm password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    error={errors.password_confirmation}
                    required
                />

                <div>
                    <label className="flex items-start gap-3 text-sm text-stone-700">
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="mt-0.5 size-5 shrink-0 accent-maroon-700"
                        />
                        <span>
                            I have read the{' '}
                            <Link to="/privacy" className="font-medium text-maroon-700 underline">
                                privacy notice
                            </Link>{' '}
                            and agree that the DRRMO keeps my name, email and duty records under the
                            Data Privacy Act of 2012.
                        </span>
                    </label>
                    {errors.privacy_consent && (
                        <p className="mt-1.5 text-sm font-medium text-red-700">
                            {errors.privacy_consent}
                        </p>
                    )}
                </div>

                {formError && <Alert tone="error">{formError}</Alert>}

                <Button type="submit" block loading={busy}>
                    {busy ? 'Sending...' : 'Request access'}
                </Button>
            </form>

            <p className="mt-5 text-sm">
                Already have an account? <AuthLink to="/login">Sign in</AuthLink>
            </p>
        </AuthLayout>
    );
}

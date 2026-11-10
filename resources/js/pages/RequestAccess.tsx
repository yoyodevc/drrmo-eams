// Request access (M-Request access in SCREENS.md). Public sign up for volunteers.
// The account stays pending until the email is confirmed and an admin approves it.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthLayout, AuthLink } from '@/app/AuthLayout';
import { RequestSteps } from '@/features/personnel/components/RequestSteps';
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
            subtitle="For volunteers. The DRRMO office checks every request before you can sign in."
        >
            <RequestSteps current={1} />

            <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
                {/* Side by side from 400 px, so large phones and the desktop column save a row. */}
                <div className="grid gap-5 min-[400px]:grid-cols-2 min-[400px]:gap-3">
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
                </div>
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
                    {/* The whole box is the tap target. It turns red when the box is left unticked. */}
                    <label
                        className={`flex cursor-pointer items-start gap-3 rounded-control border px-4 py-3.5 text-sm leading-relaxed text-stone-700 transition-colors ${errors.privacy_consent ? 'border-red-600 bg-red-50/40' : consent ? 'border-maroon-700/40 bg-maroon-50' : 'border-stone-300 bg-white hover:border-stone-400'}`}
                    >
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            aria-invalid={errors.privacy_consent ? true : undefined}
                            aria-describedby={
                                errors.privacy_consent ? 'privacy-consent-error' : undefined
                            }
                            className="mt-0.5 size-5 shrink-0 accent-maroon-700"
                        />
                        <span className="text-pretty">
                            I have read the{' '}
                            <Link
                                to="/privacy"
                                className="font-medium text-maroon-700 underline underline-offset-2 hover:text-maroon-600"
                            >
                                privacy notice
                            </Link>{' '}
                            and agree that the DRRMO keeps my name, email and duty records under the
                            Data Privacy Act of 2012.
                        </span>
                    </label>
                    {errors.privacy_consent && (
                        <p
                            id="privacy-consent-error"
                            className="mt-1.5 text-sm font-medium text-red-700"
                        >
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

// M-My details (S2.1). A person sees what DRRMO has on file and edits their own contact number.
// Mobile first at 360 px: the read only facts first, then the one thing they can change, with Save
// in the lower half of the screen where a thumb reaches.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import {
    errorMessage,
    fieldErrors,
    getMyProfile,
    saveMyContactNumber,
} from '@/features/personnel/people';
import { BackLink, LockIcon } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="px-4 py-3">
            <dt className="text-sm text-stone-500">{label}</dt>
            <dd
                className={`mt-0.5 text-base break-words ${value ? 'text-stone-900' : 'text-stone-500'}`}
            >
                {value || 'Not set'}
            </dd>
        </div>
    );
}

const eyebrow = 'text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase';

function Skeleton() {
    return (
        <div className="mt-8" aria-busy="true">
            <p role="status" className="sr-only">
                Loading your details...
            </p>
            <div aria-hidden="true">
                <div className="h-3 w-20 animate-pulse rounded bg-stone-200" />
                <div className="mt-3 divide-y divide-stone-100 rounded-card bg-white ring-1 ring-stone-200">
                    {[0, 1, 2, 3, 4].map((row) => (
                        <div key={row} className="px-4 py-3">
                            <div className="h-3 w-16 animate-pulse rounded bg-stone-200" />
                            <div className="mt-2 h-4 w-44 animate-pulse rounded bg-stone-200" />
                        </div>
                    ))}
                </div>
                <div className="mt-8 h-3 w-28 animate-pulse rounded bg-stone-200" />
                <div className="mt-3 h-44 animate-pulse rounded-card bg-stone-200" />
            </div>
        </div>
    );
}

export function MyDetails() {
    const queryClient = useQueryClient();
    const profile = useQuery({ queryKey: ['my-profile'], queryFn: getMyProfile });
    // null until the person types, so the field shows the number on file.
    const [draft, setDraft] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const number = draft ?? profile.data?.contact_number ?? '';

    const save = useMutation({
        mutationFn: () => saveMyContactNumber(number),
        onSuccess: async () => {
            setSaved(true);
            setDraft(null);
            await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        },
    });
    const errors = fieldErrors(save.error);
    const general = save.isError && Object.keys(errors).length === 0;
    const p = profile.data;
    const unchanged = number.trim() === (p?.contact_number ?? '').trim();

    function submit(event: FormEvent) {
        event.preventDefault();
        setSaved(false);
        save.mutate();
    }

    return (
        <div className="mx-auto max-w-2xl">
            <BackLink to="/me/profile">Me</BackLink>
            <div className="brand-stripe mt-2 h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                My details
            </h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                What DRRMO has on file about you.
            </p>

            {profile.isPending && <Skeleton />}

            {profile.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        Your details did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={profile.isFetching}
                        onClick={() => void profile.refetch()}
                    >
                        {profile.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {p && (
                <>
                    <section aria-labelledby="on-file" className="mt-8">
                        <h2 id="on-file" className={eyebrow}>
                            On file
                        </h2>
                        <dl className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                            <Fact label="Name" value={p.name} />
                            <Fact label="Email" value={p.email} />
                            <Fact label="Role" value={p.role_name} />
                            <Fact label="Team" value={p.team_name} />
                            <Fact label="Department" value={p.department} />
                        </dl>
                        <p className="mt-2 flex gap-2 px-1 text-sm text-pretty text-stone-600">
                            <LockIcon className="mt-0.5 size-4 shrink-0 text-stone-500" />
                            To change any of these, ask the DRRMO office.
                        </p>
                    </section>

                    <section aria-labelledby="contact-number" className="mt-8">
                        <h2 id="contact-number" className={eyebrow}>
                            Contact
                        </h2>
                        <form
                            onSubmit={submit}
                            className="mt-2 space-y-4 rounded-card bg-white p-4 ring-1 ring-stone-200 md:p-6"
                            noValidate
                        >
                            <TextField
                                label="Contact number"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={number}
                                onChange={(e) => {
                                    setDraft(e.target.value);
                                    setSaved(false);
                                }}
                                error={errors.contact_number}
                                hint="For example 0917 123 4567."
                            />
                            {general && <Alert tone="error">{errorMessage(save.error)}</Alert>}
                            {saved && unchanged && (
                                <Alert tone="success">Your contact number is saved.</Alert>
                            )}
                            <Button
                                type="submit"
                                block
                                loading={save.isPending}
                                disabled={unchanged}
                            >
                                {save.isPending ? 'Saving...' : 'Save number'}
                            </Button>
                        </form>
                    </section>
                </>
            )}
        </div>
    );
}

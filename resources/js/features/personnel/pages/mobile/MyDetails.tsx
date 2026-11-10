// M-My details (S2.1). A person sees what DRRMO has on file and edits their own contact number. Mobile first at 360 px.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
    errorMessage,
    fieldErrors,
    getMyProfile,
    roleLabels,
    saveMyContactNumber,
    teamLabels,
} from '@/features/personnel/people';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="px-4 py-3">
            <dt className="text-sm text-stone-500">{label}</dt>
            <dd className="mt-0.5 text-base break-words text-stone-900">{value || 'Not set'}</dd>
        </div>
    );
}

export function MyDetails() {
    const queryClient = useQueryClient();
    const profile = useQuery({ queryKey: ['my-profile'], queryFn: getMyProfile });
    const [number, setNumber] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (profile.data) setNumber(profile.data.contact_number ?? '');
    }, [profile.data]);

    const save = useMutation({
        mutationFn: () => saveMyContactNumber(number),
        onSuccess: async () => {
            setSaved(true);
            await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        },
    });
    const errors = fieldErrors(save.error);
    const general = save.isError && Object.keys(errors).length === 0;
    const p = profile.data;

    function submit(event: FormEvent) {
        event.preventDefault();
        setSaved(false);
        save.mutate();
    }

    return (
        <div className="mx-auto max-w-2xl">
            <Link
                to="/me/profile"
                className="-mt-2 -ml-2 inline-flex min-h-12 items-center rounded-control px-2 text-sm font-medium text-stone-700 hover:text-stone-900"
            >
                Me
            </Link>
            <div className="brand-stripe mt-2 h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                My details
            </h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                What DRRMO has on file. To change anything except your contact number, ask the DRRMO
                office.
            </p>

            {profile.isPending && (
                <p role="status" className="mt-6 text-stone-500">
                    Loading...
                </p>
            )}
            {profile.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        Your details did not load. Check your connection and try again.
                    </Alert>
                    <Button variant="secondary" block onClick={() => void profile.refetch()}>
                        Retry
                    </Button>
                </div>
            )}

            {p && (
                <>
                    <dl className="mt-6 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        <Fact label="Name" value={p.name} />
                        <Fact label="Email" value={p.email} />
                        <Fact label="Role" value={p.role ? roleLabels[p.role] : null} />
                        <Fact label="Team" value={p.team ? teamLabels[p.team] : null} />
                        <Fact label="Department" value={p.department} />
                    </dl>

                    <form
                        onSubmit={submit}
                        className="mt-6 space-y-4 rounded-card bg-white p-4 ring-1 ring-stone-200"
                        noValidate
                    >
                        <TextField
                            label="Contact number"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={number}
                            onChange={(e) => {
                                setNumber(e.target.value);
                                setSaved(false);
                            }}
                            error={errors.contact_number}
                            hint="For example 0917 123 4567."
                        />
                        {general && <Alert tone="error">{errorMessage(save.error)}</Alert>}
                        {saved && <Alert tone="success">Saved.</Alert>}
                        <Button type="submit" block loading={save.isPending}>
                            Save
                        </Button>
                    </form>
                </>
            )}
        </div>
    );
}

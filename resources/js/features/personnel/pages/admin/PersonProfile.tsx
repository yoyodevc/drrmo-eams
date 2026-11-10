// A-Person profile (S2.1). One person: details, availability with its history, emergency contacts.
// Changing availability stays on Volunteer status, where the reason is asked.
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { personContacts } from '@/features/personnel/contacts';
import { getPerson, resendInvite, roleLabels, teamLabels } from '@/features/personnel/people';
import { statusHistory } from '@/features/personnel/volunteers';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function when(value: string | null) {
    return value ? stamp.format(new Date(value)) : 'Never';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-control border border-stone-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
            <div className="mt-3">{children}</div>
        </section>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-sm text-stone-500">{label}</dt>
            <dd className="mt-0.5 text-stone-900">{children || 'Not set'}</dd>
        </div>
    );
}

export function PersonProfile() {
    const { id } = useParams();
    const personId = Number(id);
    const state = useLocation().state as { invited?: boolean } | null;

    const person = useQuery({ queryKey: ['person', personId], queryFn: () => getPerson(personId) });
    const isVolunteer = person.data?.role === 'volunteer';
    const history = useQuery({
        queryKey: ['volunteer-history', personId],
        queryFn: () => statusHistory(personId),
        enabled: isVolunteer,
    });
    const contacts = useQuery({
        queryKey: ['person-contacts', personId],
        queryFn: () => personContacts(personId),
        enabled: person.isSuccess,
    });
    const invite = useMutation({ mutationFn: () => resendInvite(personId) });

    if (person.isPending) return <p className="text-stone-500">Loading...</p>;
    if (person.isError) return <Alert tone="error">Could not load this person.</Alert>;
    const p = person.data;

    return (
        <div className="max-w-3xl">
            <Link
                to="/admin/people"
                className="text-sm font-medium text-stone-700 hover:text-stone-900"
            >
                People
            </Link>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-stone-900">{p.name}</h1>
                    <p className="mt-1 text-stone-600">
                        {[p.role ? roleLabels[p.role] : null, p.team ? teamLabels[p.team] : null]
                            .filter(Boolean)
                            .join(', ')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        loading={invite.isPending}
                        onClick={() => invite.mutate()}
                    >
                        Send set-password email
                    </Button>
                    <Link
                        to={`/admin/people/${p.id}/edit`}
                        className="inline-flex min-h-12 items-center rounded-control bg-maroon-700 px-5 font-semibold text-white hover:bg-maroon-800"
                    >
                        Edit
                    </Link>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {state?.invited === true && (
                    <Alert tone="success">
                        Added. We emailed them a link to choose a password.
                    </Alert>
                )}
                {state?.invited === false && (
                    <Alert tone="warning">
                        Added, but the email could not be sent. Use Send set-password email to try
                        again.
                    </Alert>
                )}
                {invite.isSuccess && invite.data && (
                    <Alert tone="success">Email sent to {p.email}.</Alert>
                )}
                {invite.isSuccess && !invite.data && (
                    <Alert tone="warning">
                        The email could not be sent. Try again in a moment.
                    </Alert>
                )}
                {invite.isError && <Alert tone="error">That did not work. Try again.</Alert>}
            </div>

            <div className="mt-5 space-y-5">
                <Section title="Details">
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <Fact label="Email">{p.email}</Fact>
                        <Fact label="Contact number">{p.contact_number}</Fact>
                        <Fact label="Department">{p.department?.name}</Fact>
                        <Fact label="Last sign in">{when(p.last_login_at)}</Fact>
                    </dl>
                </Section>

                <Section title="Availability">
                    <p className="text-stone-900">
                        {p.status === 'active'
                            ? 'Active. Can be assigned to duty.'
                            : 'Inactive. Not offered for duty.'}
                    </p>
                    {isVolunteer ? (
                        <>
                            <p className="mt-1 text-sm text-stone-600">
                                Change it from{' '}
                                <Link
                                    to="/admin/volunteers"
                                    className="font-medium text-maroon-800 hover:underline"
                                >
                                    Volunteer status
                                </Link>
                                .
                            </p>
                            {history.isPending && <p className="mt-3 text-stone-500">Loading...</p>}
                            {history.isError && (
                                <p className="mt-3 text-red-700">Could not load the history.</p>
                            )}
                            {history.data?.length === 0 && (
                                <p className="mt-3 text-stone-500">No changes yet.</p>
                            )}
                            <ul className="mt-3 divide-y divide-stone-100">
                                {history.data?.map((row) => (
                                    <li key={row.id} className="py-3 text-sm">
                                        <p className="font-medium text-stone-900">
                                            {row.old_status} to {row.new_status}
                                        </p>
                                        <p className="text-stone-700">{row.reason}</p>
                                        <p className="text-stone-500">
                                            {row.changed_by ?? 'Unknown'} · {when(row.changed_at)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p className="mt-1 text-sm text-stone-600">
                            Availability is only switched for volunteers.
                        </p>
                    )}
                </Section>

                <Section title="Emergency contacts">
                    {contacts.isPending && <p className="text-stone-500">Loading...</p>}
                    {contacts.isError && (
                        <p className="text-red-700">Could not load the contacts.</p>
                    )}
                    {contacts.data?.length === 0 && (
                        <p className="text-stone-500">This person has not added any contacts.</p>
                    )}
                    <ul className="divide-y divide-stone-100">
                        {contacts.data?.map((c) => (
                            <li key={c.id} className="py-3 text-sm">
                                <p className="font-medium text-stone-900">{c.name}</p>
                                <p className="text-stone-700">{c.relationship}</p>
                                <p className="text-stone-700 tabular-nums">{c.phone}</p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-xs text-stone-500">
                        Opening this list is recorded in the audit log.
                    </p>
                </Section>
            </div>
        </div>
    );
}

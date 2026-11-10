// A-Person profile (S2.1). One person: details, availability with its history, emergency contacts.
// Desktop first at 1280 px: main column for details and availability, side column for contacts and
// sign in. On phones it stacks in that order. Changing availability stays on Volunteer status,
// where the reason is asked.
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { personContacts } from '@/features/personnel/contacts';
import { getPerson, resendInvite, roleLabels } from '@/features/personnel/people';
import { statusHistory, type Availability } from '@/features/personnel/volunteers';
import {
    AvailabilityChip,
    Avatar,
    BackLink,
    EditIcon,
    HistoryIcon,
    LockIcon,
    MailIcon,
    PhoneIcon,
    day,
    stamp,
} from '@/features/personnel/components/ui';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const statusWords: Record<Availability, string> = { active: 'active', inactive: 'inactive' };

function Card({
    title,
    id,
    aside,
    children,
}: {
    title: string;
    id: string;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section
            aria-labelledby={id}
            className="rounded-card bg-white p-4 ring-1 ring-stone-200 md:p-6"
        >
            <div className="flex items-center justify-between gap-3">
                <h2 id={id} className="text-lg font-semibold text-stone-900">
                    {title}
                </h2>
                {aside}
            </div>
            <div className="mt-4">{children}</div>
        </section>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-sm text-stone-500">{label}</dt>
            <dd className="mt-0.5 break-words text-stone-900">
                {children || <span className="text-stone-500">Not set</span>}
            </dd>
        </div>
    );
}

function Placeholder({ lines = 2 }: { lines?: number }) {
    return (
        <div aria-hidden="true" className="space-y-3">
            {Array.from({ length: lines }, (_, i) => (
                <div key={i}>
                    <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                    <div className="mt-2 h-3 w-56 animate-pulse rounded bg-stone-200" />
                </div>
            ))}
        </div>
    );
}

function Skeleton() {
    return (
        <div aria-busy="true">
            <p role="status" className="sr-only">
                Loading this person...
            </p>
            <div aria-hidden="true">
                <div className="flex items-center gap-4">
                    <div className="size-14 animate-pulse rounded-full bg-stone-200" />
                    <div>
                        <div className="h-7 w-56 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-stone-200" />
                    </div>
                </div>
                <div className="mt-8 grid gap-6 lg:grid-cols-3">
                    <div className="h-56 animate-pulse rounded-card bg-stone-200 lg:col-span-2" />
                    <div className="h-56 animate-pulse rounded-card bg-stone-200" />
                </div>
            </div>
        </div>
    );
}

export function PersonProfile() {
    const { id } = useParams();
    const personId = Number(id);
    const state = useLocation().state as { invited?: boolean; from?: string } | null;
    const listUrl = `/admin/people${state?.from ?? ''}`;

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

    if (person.isPending) {
        return (
            <div className="mx-auto max-w-6xl">
                <BackLink to={listUrl}>People</BackLink>
                <div className="mt-4">
                    <Skeleton />
                </div>
            </div>
        );
    }

    if (person.isError) {
        const missing = person.error instanceof ApiError && person.error.status === 404;
        return (
            <div className="mx-auto max-w-6xl">
                <BackLink to={listUrl}>People</BackLink>
                <div className="mt-4 max-w-xl space-y-3">
                    <Alert tone="error">
                        {missing
                            ? 'This person was not found. They may have been removed.'
                            : 'This profile did not load. Check your connection and try again.'}
                    </Alert>
                    {!missing && (
                        <Button
                            variant="secondary"
                            size="md"
                            loading={person.isFetching}
                            onClick={() => void person.refetch()}
                        >
                            {person.isFetching ? 'Retrying...' : 'Retry'}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    const p = person.data;
    const about = [p.role ? roleLabels[p.role] : null, p.team_name].filter(Boolean).join(' · ');
    const neverSignedIn = p.last_login_at === null;

    return (
        <div className="mx-auto max-w-6xl">
            <BackLink to={listUrl}>People</BackLink>

            <header className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
                <div className="flex min-w-0 items-center gap-4">
                    <Avatar
                        first={p.first_name}
                        last={p.last_name}
                        size="lg"
                        dim={p.status === 'inactive'}
                    />
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-tight text-balance text-stone-900">
                            {p.name}
                        </h1>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-stone-700">{about || 'No role'}</p>
                            <AvailabilityChip status={p.status} />
                        </div>
                    </div>
                </div>
                <Link
                    to={`/admin/people/${p.id}/edit`}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-maroon-700 px-5 text-base font-semibold text-white transition-colors hover:bg-maroon-800 active:bg-maroon-900 sm:w-auto md:min-h-10 md:px-4 md:text-sm"
                >
                    <EditIcon className="size-5 md:size-4" />
                    Edit details
                </Link>
            </header>

            {state?.invited !== undefined && (
                <div className="mt-6 max-w-2xl">
                    {state.invited ? (
                        <Alert tone="success">
                            {p.first_name} is added. We emailed {p.email} a link to choose a
                            password.
                        </Alert>
                    ) : (
                        <Alert tone="warning">
                            {p.first_name} is added, but the email did not go out. Use Send
                            set-password email below to try again.
                        </Alert>
                    )}
                </div>
            )}

            <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card title="Details" id="details-title">
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Fact label="Email">
                                <a
                                    href={`mailto:${p.email}`}
                                    className="font-medium text-maroon-700 underline-offset-2 hover:underline"
                                >
                                    {p.email}
                                </a>
                            </Fact>
                            <Fact label="Contact number">
                                {p.contact_number && (
                                    <a
                                        href={`tel:${p.contact_number.replace(/\s+/g, '')}`}
                                        className="font-medium text-maroon-700 tabular-nums underline-offset-2 hover:underline"
                                    >
                                        {p.contact_number}
                                    </a>
                                )}
                            </Fact>
                            <Fact label="Role">{p.role ? roleLabels[p.role] : null}</Fact>
                            <Fact label="Team">{p.team_name}</Fact>
                            <Fact label="Department">{p.department?.name}</Fact>
                            <Fact label="Added">{day(p.created_at)}</Fact>
                        </dl>
                    </Card>

                    <Card
                        title="Availability"
                        id="availability-title"
                        aside={<AvailabilityChip status={p.status} />}
                    >
                        <p className="text-pretty text-stone-700">
                            {p.status === 'active'
                                ? 'Can be assigned to duties.'
                                : 'Not offered when you assign people to duty.'}
                        </p>
                        {isVolunteer ? (
                            <>
                                <p className="mt-1 text-sm text-stone-600">
                                    Change it on{' '}
                                    <Link
                                        to="/admin/volunteers"
                                        className="font-medium text-maroon-700 underline-offset-2 hover:underline"
                                    >
                                        Volunteer status
                                    </Link>
                                    , where you give a reason.
                                </p>
                                <h3 className="mt-6 text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                                    History
                                </h3>
                                <div className="mt-2">
                                    {history.isPending && <Placeholder />}
                                    {history.isError && (
                                        <div className="flex flex-wrap items-center gap-3">
                                            <p className="text-sm text-red-700">
                                                The history did not load.
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="md"
                                                onClick={() => void history.refetch()}
                                            >
                                                Retry
                                            </Button>
                                        </div>
                                    )}
                                    {history.data?.length === 0 && (
                                        <p className="flex items-center gap-2 text-sm text-stone-600">
                                            <HistoryIcon className="size-4 text-stone-500" />
                                            No changes yet.
                                        </p>
                                    )}
                                    {history.data && history.data.length > 0 && (
                                        <ul className="divide-y divide-stone-100 border-t border-stone-100">
                                            {history.data.map((row) => (
                                                <li key={row.id} className="py-3">
                                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                                        <p className="font-semibold text-stone-900">
                                                            Set to {statusWords[row.new_status]}
                                                        </p>
                                                        {row.changed_at && (
                                                            <p className="text-sm text-stone-500 tabular-nums">
                                                                {stamp(row.changed_at)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-pretty text-stone-700">
                                                        {row.reason}
                                                    </p>
                                                    <p className="mt-0.5 text-sm text-stone-500">
                                                        By {row.changed_by ?? 'an unknown admin'}
                                                    </p>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="mt-1 text-sm text-stone-600">
                                Only volunteers are switched between active and inactive.
                            </p>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Emergency contacts" id="contacts-title">
                        {contacts.isPending && <Placeholder />}
                        {contacts.isError && (
                            <div className="flex flex-wrap items-center gap-3">
                                <p className="text-sm text-red-700">The contacts did not load.</p>
                                <Button
                                    variant="ghost"
                                    size="md"
                                    onClick={() => void contacts.refetch()}
                                >
                                    Retry
                                </Button>
                            </div>
                        )}
                        {contacts.data?.length === 0 && (
                            <p className="text-sm text-pretty text-stone-600">
                                {p.first_name} has not added anyone yet.
                            </p>
                        )}
                        {contacts.data && contacts.data.length > 0 && (
                            <ul className="-my-3 divide-y divide-stone-100">
                                {contacts.data.map((c) => (
                                    <li key={c.id} className="flex items-center gap-3 py-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium break-words text-stone-900">
                                                {c.name}
                                            </p>
                                            <p className="text-sm text-stone-600">
                                                {c.relationship}
                                            </p>
                                            <p className="text-sm text-stone-700 tabular-nums">
                                                {c.phone}
                                            </p>
                                        </div>
                                        <a
                                            href={`tel:${c.phone.replace(/\s+/g, '')}`}
                                            aria-label={`Call ${c.name}`}
                                            className="inline-flex size-12 shrink-0 items-center justify-center rounded-control border border-stone-300 text-maroon-700 transition-colors hover:bg-stone-50 active:bg-stone-100 md:size-10"
                                        >
                                            <PhoneIcon className="size-5" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-4 flex gap-2 border-t border-stone-100 pt-3 text-xs text-pretty text-stone-500">
                            <LockIcon className="size-4 shrink-0" />
                            Opening this list is recorded in the audit log.
                        </p>
                    </Card>

                    <Card title="Sign in" id="signin-title">
                        <dl>
                            <Fact label="Last sign in">
                                {stamp(p.last_login_at) ?? 'Never signed in'}
                            </Fact>
                        </dl>
                        <p className="mt-3 text-sm text-pretty text-stone-600">
                            {neverSignedIn
                                ? 'If the first email got lost or expired, send a new link to set a password.'
                                : 'They can reset a forgotten password from the sign in screen, or you can send a new link.'}
                        </p>
                        <div className="mt-4 space-y-3">
                            {invite.isSuccess && invite.data && (
                                <Alert tone="success">Email sent to {p.email}.</Alert>
                            )}
                            {invite.isSuccess && !invite.data && (
                                <Alert tone="warning">
                                    The email did not go out. Try again in a moment.
                                </Alert>
                            )}
                            {invite.isError && (
                                <Alert tone="error">
                                    That did not work. Check your connection and try again.
                                </Alert>
                            )}
                            <Button
                                variant="secondary"
                                size="md"
                                block
                                className="max-md:min-h-12 max-md:text-base"
                                loading={invite.isPending}
                                onClick={() => invite.mutate()}
                            >
                                {!invite.isPending && <MailIcon className="size-4" />}
                                {invite.isPending ? 'Sending...' : 'Send set-password email'}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

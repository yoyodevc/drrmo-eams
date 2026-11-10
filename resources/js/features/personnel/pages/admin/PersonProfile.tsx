// A-Person profile (S2.1, S2.4). One person: details, availability with its history, emergency contacts.
// Desktop first at 1280 px: main column for availability and details, side column for contacts and
// sign in. On phones it stacks in that order. A volunteer is set active or inactive here, with a
// reason (SCREENS.md: the volunteer toggle is part of the profile, not a separate page).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { personContacts } from '@/features/personnel/contacts';
import { getPerson, resendInvite, roleLabels } from '@/features/personnel/people';
import {
    setVolunteerStatus,
    statusHistory,
    type Availability,
    type StatusChange,
} from '@/features/personnel/volunteers';
import {
    AvailabilityChip,
    Avatar,
    BackLink,
    chipBase,
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
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';

const statusWords: Record<Availability, string> = { active: 'Active', inactive: 'Inactive' };

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
            <div className="mt-3">{children}</div>
        </section>
    );
}

// One label and value per line, split by hairlines. The label sits beside the value from 640 px.
function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid min-w-0 gap-0.5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-sm text-stone-500 sm:pt-px">{label}</dt>
            <dd className="min-w-0 break-words text-stone-900">
                {children || <span className="text-stone-500">Not set</span>}
            </dd>
        </div>
    );
}

function FactGroup({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div>
            <h3 className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                {title}
            </h3>
            <dl className="mt-1 divide-y divide-stone-100">{children}</dl>
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
    const neverSignedIn = p.last_login_at === null;
    const placement = [p.team_name, p.department?.name].filter(Boolean).join(' · ');

    return (
        <div className="mx-auto max-w-6xl">
            <BackLink to={listUrl}>People</BackLink>

            <header className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
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
                        <p className="mt-0.5 text-stone-700">
                            <span className="font-medium text-stone-900">
                                {p.role ? roleLabels[p.role] : 'No role'}
                            </span>
                            {placement && <span className="text-stone-600"> · {placement}</span>}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <AvailabilityChip status={p.status} />
                            {neverSignedIn && (
                                <span
                                    className={`${chipBase} bg-amber-50 text-amber-900 ring-amber-200`}
                                >
                                    Has not signed in yet
                                </span>
                            )}
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
                    {isVolunteer && (
                        <AvailabilityCard
                            personId={p.id}
                            firstName={p.first_name}
                            status={p.status}
                            history={history}
                        />
                    )}

                    <Card title="Details" id="details-title">
                        <div className="space-y-6">
                            <FactGroup title="Contact">
                                <Fact label="Email">
                                    <a
                                        href={`mailto:${p.email}`}
                                        className="inline-flex items-center gap-2 font-medium break-all text-maroon-700 underline-offset-2 hover:underline"
                                    >
                                        <MailIcon className="size-4 shrink-0 text-stone-500" />
                                        {p.email}
                                    </a>
                                </Fact>
                                <Fact label="Contact number">
                                    {p.contact_number && (
                                        <a
                                            href={`tel:${p.contact_number.replace(/\s+/g, '')}`}
                                            className="inline-flex items-center gap-2 font-medium text-maroon-700 tabular-nums underline-offset-2 hover:underline"
                                        >
                                            <PhoneIcon className="size-4 shrink-0 text-stone-500" />
                                            {p.contact_number}
                                        </a>
                                    )}
                                </Fact>
                            </FactGroup>
                            <FactGroup title="Placement">
                                <Fact label="Role">{p.role ? roleLabels[p.role] : null}</Fact>
                                <Fact label="Team">{p.team_name}</Fact>
                                <Fact label="Department">{p.department?.name}</Fact>
                                {!isVolunteer && (
                                    <Fact label="Availability">
                                        {p.status === 'active'
                                            ? 'Active. Can be assigned to duties.'
                                            : 'Inactive. Not offered for duties.'}
                                    </Fact>
                                )}
                                <Fact label="Added">{day(p.created_at)}</Fact>
                            </FactGroup>
                        </div>
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
                        <p className="text-sm text-stone-500">Last sign in</p>
                        <p className="mt-0.5 font-medium text-stone-900 tabular-nums">
                            {stamp(p.last_login_at) ?? 'Has not signed in yet'}
                        </p>
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

// Volunteers only. Says what the status means, switches it with a reason, and lists every change.
function AvailabilityCard({
    personId,
    firstName,
    status,
    history,
}: {
    personId: number;
    firstName: string;
    status: Availability;
    history: {
        isPending: boolean;
        isError: boolean;
        data?: StatusChange[];
        refetch: () => unknown;
    };
}) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const next: Availability = status === 'active' ? 'inactive' : 'active';
    const change = useMutation({
        mutationFn: () => setVolunteerStatus(personId, next, reason.trim()),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['person', personId] }),
                queryClient.invalidateQueries({ queryKey: ['volunteer-history', personId] }),
                queryClient.invalidateQueries({ queryKey: ['people'] }),
            ]);
            setOpen(false);
        },
    });
    const reasonOk = reason.trim().length >= 3;
    const active = status === 'active';

    return (
        <Card title="Availability" id="availability-title">
            <div className="flex flex-col gap-4 rounded-control bg-stone-50 p-4 ring-1 ring-stone-200 ring-inset sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${active ? 'bg-green-600' : 'bg-stone-400'}`}
                    />
                    <div className="min-w-0">
                        <p className="font-semibold text-stone-900">
                            {active ? 'Active' : 'Inactive'}
                        </p>
                        <p className="text-sm text-pretty text-stone-600">
                            {active
                                ? `${firstName} can be assigned to duties.`
                                : `${firstName} is not offered when you assign duties.`}
                        </p>
                    </div>
                </div>
                <Button
                    variant="secondary"
                    size="md"
                    className="shrink-0 max-sm:min-h-12 max-sm:w-full max-sm:text-base"
                    onClick={() => {
                        change.reset();
                        setReason('');
                        setOpen(true);
                    }}
                >
                    {active ? 'Set inactive' : 'Set active'}
                </Button>
            </div>

            <h3 className="mt-6 text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                History
            </h3>
            <div className="mt-3">
                {history.isPending && <Placeholder />}
                {history.isError && (
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm text-red-700">The history did not load.</p>
                        <Button variant="ghost" size="md" onClick={() => void history.refetch()}>
                            Retry
                        </Button>
                    </div>
                )}
                {history.data?.length === 0 && (
                    <p className="flex items-center gap-2 text-sm text-stone-600">
                        <HistoryIcon className="size-4 text-stone-500" />
                        No changes yet. {firstName} has been {active ? 'active' : 'inactive'} since
                        joining.
                    </p>
                )}
                {history.data && history.data.length > 0 && (
                    <ol>
                        {history.data.map((row) => (
                            <li key={row.id} className="group relative pb-5 pl-6 last:pb-0">
                                {/* The line joins this change to the one below it. */}
                                <span
                                    aria-hidden="true"
                                    className="absolute top-4 bottom-0 left-[4.5px] w-px bg-stone-200 group-last:hidden"
                                />
                                <span
                                    aria-hidden="true"
                                    className={`absolute top-1.5 left-0 size-2.5 rounded-full ${row.new_status === 'active' ? 'bg-green-600' : 'bg-stone-400'}`}
                                />
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                    <p className="font-semibold text-stone-900">
                                        Set to {statusWords[row.new_status].toLowerCase()}
                                    </p>
                                    {row.changed_at && (
                                        <p className="text-sm text-stone-500 tabular-nums">
                                            {stamp(row.changed_at)}
                                        </p>
                                    )}
                                </div>
                                <p className="mt-0.5 text-pretty text-stone-700">{row.reason}</p>
                                <p className="mt-0.5 text-sm text-stone-500">
                                    By {row.changed_by ?? 'an unknown admin'}
                                </p>
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            <ConfirmDialog
                open={open}
                title={active ? `Set ${firstName} as inactive?` : `Set ${firstName} as active?`}
                description={
                    active
                        ? 'They will not be offered when you assign duties until someone sets them active again.'
                        : 'They will be offered again when you assign duties.'
                }
                confirmLabel={active ? 'Set inactive' : 'Set active'}
                loadingLabel="Saving..."
                loading={change.isPending}
                confirmDisabled={!reasonOk}
                error={
                    change.isError
                        ? 'That did not save. Check your connection and try again.'
                        : null
                }
                onConfirm={() => change.mutate()}
                onCancel={() => setOpen(false)}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (reasonOk && !change.isPending) change.mutate();
                    }}
                >
                    <TextField
                        label="Reason"
                        hint="Kept in the history and the audit log."
                        placeholder={active ? 'For example, on leave until May' : undefined}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={255}
                        required
                    />
                </form>
            </ConfirmDialog>
        </Card>
    );
}

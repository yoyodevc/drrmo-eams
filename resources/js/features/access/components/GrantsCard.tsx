// Grants card on the admin person profile (S2.7). Lists every grant for this person and lets an
// admin give a new one or end one early. Every change needs a reason and is written to the audit log.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
    createGrant,
    grantOptions,
    listGrants,
    revokeGrant,
    type Grant,
    type GrantStatus,
} from '@/features/access/api';
import { listEvents } from '@/features/events/api';
import { chipBase, LockIcon, PlusIcon, stamp } from '@/features/personnel/components/ui';
import { errorMessage, fieldErrors, listPeople } from '@/features/personnel/people';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';

const chips: Record<GrantStatus, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-50 text-green-800 ring-green-200' },
    upcoming: { label: 'Upcoming', className: 'bg-amber-50 text-amber-900 ring-amber-200' },
    ended: { label: 'Ended', className: 'bg-stone-100 text-stone-600 ring-stone-200' },
    revoked: { label: 'Revoked', className: 'bg-stone-100 text-stone-600 ring-stone-200' },
};

// Exact moment to a local "YYYY-MM-DDTHH:mm" value for a datetime-local input.
function toLocalInput(date: Date): string {
    const copy = new Date(date);
    copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
    return copy.toISOString().slice(0, 16);
}

const selectClass =
    'block min-h-12 w-full cursor-pointer rounded-control border border-stone-300 bg-white px-3.5 text-base text-stone-900 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none';

export function GrantsCard({ personId, firstName }: { personId: number; firstName: string }) {
    const queryClient = useQueryClient();
    const grants = useQuery({
        queryKey: ['grants', personId],
        queryFn: () => listGrants(personId),
    });
    const [giving, setGiving] = useState(false);
    const [ending, setEnding] = useState<Grant | null>(null);

    const revoke = useMutation({
        mutationFn: (id: number) => revokeGrant(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['grants', personId] });
            setEnding(null);
        },
    });

    return (
        <section
            aria-labelledby="grants-title"
            className="rounded-card bg-white p-4 ring-1 ring-stone-200 md:p-6"
        >
            <div className="flex items-center justify-between gap-3">
                <h2 id="grants-title" className="text-lg font-semibold text-stone-900">
                    Extra access
                </h2>
                <Button variant="secondary" size="md" onClick={() => setGiving(true)}>
                    <PlusIcon className="size-4" />
                    Give access
                </Button>
            </div>
            <p className="mt-1 text-sm text-pretty text-stone-600">
                Time-limited access on top of {firstName}&apos;s role. It stops by itself when it
                ends.
            </p>

            <div className="mt-4">
                {grants.isPending && (
                    <div aria-hidden="true" className="h-14 animate-pulse rounded bg-stone-100" />
                )}
                {grants.isError && (
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm text-red-700">The grants did not load.</p>
                        <Button variant="ghost" size="md" onClick={() => void grants.refetch()}>
                            Retry
                        </Button>
                    </div>
                )}
                {grants.data?.length === 0 && (
                    <p className="text-sm text-stone-600">
                        {firstName} has no extra access. Use Give access to add some.
                    </p>
                )}
                {grants.data && grants.data.length > 0 && (
                    <ul className="-my-3 divide-y divide-stone-100">
                        {grants.data.map((g) => (
                            <li key={g.id} className="py-3">
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                    <p className="font-semibold text-stone-900">
                                        {g.permission.label}
                                    </p>
                                    <span className={`${chipBase} ${chips[g.status].className}`}>
                                        {chips[g.status].label}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-sm text-stone-600">
                                    {g.event ? `For ${g.event.title}. ` : ''}
                                    {stamp(g.starts_at)} to {stamp(g.ends_at)}
                                </p>
                                <p className="mt-0.5 text-pretty text-stone-700">{g.reason}</p>
                                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm text-stone-500">
                                        {g.status === 'revoked'
                                            ? `Revoked by ${g.revoked_by ?? 'an admin'}`
                                            : `Given by ${g.granted_by ?? 'an admin'}`}
                                    </p>
                                    {(g.status === 'active' || g.status === 'upcoming') && (
                                        <Button
                                            variant="ghost"
                                            size="md"
                                            onClick={() => {
                                                revoke.reset();
                                                setEnding(g);
                                            }}
                                        >
                                            End access
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <p className="mt-4 flex gap-2 border-t border-stone-100 pt-3 text-xs text-pretty text-stone-500">
                <LockIcon className="size-4 shrink-0" />
                Giving and ending access is recorded in the audit log.
            </p>

            <GiveDialog
                key={giving ? 'open' : 'closed'}
                open={giving}
                personId={personId}
                firstName={firstName}
                onClose={() => setGiving(false)}
                onSaved={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['grants', personId] });
                    setGiving(false);
                }}
            />

            <ConfirmDialog
                open={ending !== null}
                tone="danger"
                title="End this access now?"
                description={
                    ending
                        ? `${firstName} loses "${ending.permission.label}" straight away. The grant stays in the history.`
                        : ''
                }
                confirmLabel="End access"
                loadingLabel="Ending..."
                loading={revoke.isPending}
                error={
                    revoke.isError
                        ? 'That did not work. Check your connection and try again.'
                        : null
                }
                onConfirm={() => ending && revoke.mutate(ending.id)}
                onCancel={() => setEnding(null)}
            />
        </section>
    );
}

export function GiveDialog({
    open,
    personId,
    firstName,
    onClose,
    onSaved,
}: {
    open: boolean;
    // Left out on the Access page, where the admin picks the person in the dialog.
    personId?: number;
    firstName?: string;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [code, setCode] = useState('');
    const [eventId, setEventId] = useState('');
    const [starts, setStarts] = useState(() => toLocalInput(new Date()));
    const [ends, setEnds] = useState(() => toLocalInput(new Date(Date.now() + 86_400_000)));
    const [reason, setReason] = useState('');
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState('');
    const needsPerson = personId === undefined;

    const options = useQuery({ queryKey: ['grant-options'], queryFn: grantOptions, enabled: open });
    const choice = options.data?.find((g) => g.code === code) ?? null;
    const people = useQuery({
        queryKey: ['people', 'grant-picker', search],
        queryFn: () =>
            listPeople({ search, role: '', team: '', status: '', department: '', page: 1 }),
        enabled: open && needsPerson,
    });
    const candidates = people.data?.data.filter((p) => p.role !== 'admin') ?? [];
    const events = useQuery({ queryKey: ['events', 'all'], queryFn: listEvents, enabled: open });
    const save = useMutation({
        mutationFn: () =>
            createGrant({
                user_id: personId ?? Number(picked),
                permission: code,
                event_id: eventId ? Number(eventId) : null,
                starts_at: new Date(starts).toISOString(),
                ends_at: new Date(ends).toISOString(),
                reason: reason.trim(),
            }),
        onSuccess: onSaved,
    });
    const errors = fieldErrors(save.error);
    const ready =
        (!needsPerson || picked !== '') &&
        reason.trim().length >= 3 &&
        starts !== '' &&
        ends !== '' &&
        choice !== null &&
        (!choice.needs_event || eventId !== '');
    const general = save.isError && Object.keys(errors).length === 0;

    return (
        <ConfirmDialog
            open={open}
            title={firstName ? `Give ${firstName} extra access` : 'Give extra access'}
            description="Pick what they can do and for how long. It ends by itself."
            confirmLabel="Give access"
            loadingLabel="Saving..."
            loading={save.isPending}
            confirmDisabled={!ready}
            error={general ? errorMessage(save.error) : null}
            onConfirm={() => save.mutate()}
            onCancel={onClose}
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (ready && !save.isPending) save.mutate();
                }}
            >
                {needsPerson && (
                    <div className="space-y-2">
                        <TextField
                            label="Person"
                            type="search"
                            placeholder="Search by name or email"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPicked('');
                            }}
                            error={errors.user_id}
                        />
                        <select
                            aria-label="Choose a person"
                            className={selectClass}
                            value={picked}
                            onChange={(e) => setPicked(e.target.value)}
                        >
                            <option value="">
                                {people.isPending ? 'Loading...' : 'Choose a person'}
                            </option>
                            {candidates.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.role_name ?? 'No role'})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <label className="block text-sm font-medium text-stone-800">
                    <span className="mb-1.5 block">Access</span>
                    <select
                        className={selectClass}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    >
                        <option value="">
                            {options.isPending ? 'Loading...' : 'Choose what to allow'}
                        </option>
                        {options.data?.map((g) => (
                            <option key={g.code} value={g.code}>
                                {g.label}: {g.description}
                            </option>
                        ))}
                    </select>
                    {errors.permission && (
                        <span className="mt-1.5 block text-sm font-medium text-red-700">
                            {errors.permission}
                        </span>
                    )}
                </label>
                <label className="block text-sm font-medium text-stone-800">
                    <span className="mb-1.5 block">
                        Event{choice?.needs_event ? '' : ' (optional)'}
                    </span>
                    <select
                        className={selectClass}
                        value={eventId}
                        onChange={(e) => setEventId(e.target.value)}
                    >
                        <option value="">
                            {choice?.needs_event ? 'Choose an event' : 'Any event'}
                        </option>
                        {events.data?.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                                {ev.title}
                            </option>
                        ))}
                    </select>
                    {errors.event_id && (
                        <span className="mt-1.5 block text-sm font-medium text-red-700">
                            {errors.event_id}
                        </span>
                    )}
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        label="Starts"
                        type="datetime-local"
                        value={starts}
                        onChange={(e) => setStarts(e.target.value)}
                        error={errors.starts_at}
                        required
                    />
                    <TextField
                        label="Ends"
                        type="datetime-local"
                        value={ends}
                        min={starts}
                        onChange={(e) => setEnds(e.target.value)}
                        error={errors.ends_at}
                        hint={choice?.max_days ? `At most ${choice.max_days} days.` : undefined}
                        required
                    />
                </div>
                <TextField
                    label="Reason"
                    hint="Kept in the history and the audit log."
                    placeholder="For example, site reporter for Foundation Day"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    error={errors.reason}
                    maxLength={255}
                    required
                />
            </form>
        </ConfirmDialog>
    );
}

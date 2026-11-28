// A-Event detail (SCREENS.md). Admin sees the event with Marshals and Volunteers side by side.
// Each side lists its duties with the people in them, and one form assigns a person to a duty.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
    assignPerson,
    cancelEvent,
    createRequirement,
    getEvent,
    getLookups,
    listCandidates,
    publishEvent,
    cancelAssignment,
    markNoShow,
    removeAssignment,
    removeRequirement,
    type Assignment,
    type EventSummary,
    type Option,
    type Requirement,
} from '@/features/events/api';
import { controlClass, duration, pickerClass } from '@/features/events/components/fields';
import {
    CalendarIcon,
    ChevronIcon,
    ClockIcon,
    PencilIcon,
    PeopleIcon,
    PinIcon,
    PlusIcon,
    TagIcon,
} from '@/features/events/components/icons';
import { SelectField, SelectOption } from '@/features/events/components/SelectField';
import {
    assignmentStatuses,
    busyChip,
    chipClass,
    schedule,
    statuses,
} from '@/features/events/format';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';

type Role = 'marshal' | 'volunteer';

const roleLabels: Record<Role, { plural: string; one: string }> = {
    marshal: { plural: 'Marshals', one: 'marshal' },
    volunteer: { plural: 'Volunteers', one: 'volunteer' },
};

function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    return (
        (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
    ).toUpperCase();
}

function BackLink() {
    return (
        <Link
            to="/admin/events"
            className="-ml-1 inline-flex items-center gap-1 rounded-control px-1 py-1 text-sm font-medium text-stone-600 transition-colors hover:text-maroon-700"
        >
            <ChevronIcon className="size-4 rotate-90" />
            Events
        </Link>
    );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-center gap-2 text-sm text-stone-700">
            <span className="text-stone-500">{icon}</span>
            {children}
        </div>
    );
}

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayTime = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function shiftText(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return start.toDateString() === end.toDateString()
        ? `${dayTime.format(start)} to ${time.format(end)}`
        : `${dayTime.format(start)} to ${dayTime.format(end)}`;
}

function dutyName(requirement: Requirement) {
    return requirement.team_needed
        ? `${requirement.duty_type.name}, ${requirement.team_needed}`
        : requirement.duty_type.name;
}

function failMessage(failure: unknown): string {
    if (failure instanceof ApiError && failure.status === 422) {
        const body = failure.body as { message?: string } | null;
        return body?.message ?? 'That did not work. Refresh and try again.';
    }
    if (failure instanceof Error && !(failure instanceof ApiError)) return failure.message;
    return 'That did not work. Check your connection and try again.';
}

function OpenSpot() {
    return (
        <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-stone-300 text-stone-400"
            aria-hidden="true"
        >
            <PlusIcon className="size-4" />
        </span>
    );
}

const stillNeeded = (open: number, labels: { plural: string; one: string }) =>
    `${open} ${open === 1 ? labels.one : labels.plural.toLowerCase()} still needed`;

// People who hold a spot. No shows and removed people do not count.
const holdsSpot = (row: Assignment) => row.status !== 'no_show' && row.status !== 'cancelled';
const spotsTaken = (requirement: Requirement) => requirement.assignments.filter(holdsSpot).length;

const rowButton =
    'inline-flex min-h-10 items-center rounded-control px-3 text-sm font-semibold transition-colors disabled:cursor-progress disabled:opacity-60';

type RowAction = { kind: 'no_show' | 'cancel'; row: Assignment };

function ReasonField({
    id,
    label = 'Reason',
    value,
    onChange,
    hint,
}: {
    id: string;
    label?: string;
    value: string;
    onChange: (value: string) => void;
    hint: string;
}) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-800">
                {label}
            </label>
            <textarea
                id={id}
                rows={2}
                maxLength={500}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-describedby={`${id}-hint`}
                className={`${controlClass(false)} min-h-20 resize-y py-2.5 leading-relaxed`}
            />
            <p id={`${id}-hint`} className="mt-1.5 text-sm text-stone-500">
                {hint}
            </p>
        </div>
    );
}

// One duty inside a role column: a quiet header row, then the people in it.
function DutyGroup({
    requirement,
    editable,
    selected,
    onPick,
    onError,
}: {
    requirement: Requirement;
    editable: boolean;
    // True when the Add form below has this duty picked.
    selected: boolean;
    onPick: () => void;
    onError: (message: string | null) => void;
}) {
    const queryClient = useQueryClient();
    const labels = roleLabels[requirement.role];
    const filled = spotsTaken(requirement);
    const acknowledged = requirement.assignments.filter((a) => a.status === 'acknowledged').length;
    const open = Math.max(requirement.headcount - filled, 0);
    const [action, setAction] = useState<RowAction | null>(null);
    const [reason, setReason] = useState('');
    const [dialogError, setDialogError] = useState<string | null>(null);

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ['event'] }),
            queryClient.invalidateQueries({ queryKey: ['requirement-candidates'] }),
        ]);
    // Someone who has not acknowledged yet comes off at once. After that, a reason is needed.
    const remove = useMutation({
        mutationFn: (row: Assignment) => removeAssignment(row.id),
        onSuccess: refresh,
        onError: (failure) => onError(failMessage(failure)),
    });
    const confirm = useMutation({
        mutationFn: (current: RowAction) =>
            current.kind === 'no_show'
                ? markNoShow(current.row.id)
                : cancelAssignment(current.row.id, reason.trim()),
        onSuccess: async () => {
            await refresh();
            setAction(null);
        },
        onError: (failure) => setDialogError(failMessage(failure)),
    });
    const [now] = useState(() => Date.now());
    const started = new Date(requirement.shift_starts_at).getTime() <= now;
    const dropDuty = useMutation({
        mutationFn: () => removeRequirement(requirement.id),
        onSuccess: refresh,
        onError: (failure) => onError(failMessage(failure)),
    });

    function ask(kind: RowAction['kind'], row: Assignment) {
        onError(null);
        setReason('');
        setDialogError(null);
        setAction({ kind, row });
    }

    const person = action?.row.person.name ?? '';
    const firstName = person.split(' ')[0];

    return (
        <li>
            <div
                className={`flex items-start justify-between gap-4 border-t border-stone-200 px-6 py-2.5 transition-colors ${selected ? 'bg-maroon-50' : 'bg-stone-50'}`}
            >
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-stone-900">
                        {dutyName(requirement)}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-600 tabular-nums">
                        <ClockIcon className="size-3.5 shrink-0 text-stone-500" />
                        {shiftText(requirement.shift_starts_at, requirement.shift_ends_at)}
                    </p>
                    {requirement.instructions && (
                        <p
                            className="mt-1 line-clamp-2 text-xs whitespace-pre-line text-stone-500"
                            title={requirement.instructions}
                        >
                            {requirement.instructions}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {editable && requirement.assignments.length === 0 && (
                        <button
                            type="button"
                            disabled={dropDuty.isPending}
                            onClick={() => {
                                onError(null);
                                dropDuty.mutate();
                            }}
                            className="inline-flex min-h-8 items-center rounded-control px-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-progress disabled:opacity-60"
                            aria-label={`Delete duty ${dutyName(requirement)}`}
                        >
                            {dropDuty.isPending ? 'Deleting...' : 'Delete'}
                        </button>
                    )}
                    <div className="text-right">
                        {open === 0 ? (
                            <span
                                className={`${chipClass} bg-green-50 text-green-800 ring-green-200 tabular-nums`}
                            >
                                Full, {filled} of {requirement.headcount}
                            </span>
                        ) : (
                            <p className="text-sm text-stone-600 tabular-nums">
                                <span className="font-semibold text-stone-900">{filled}</span> of{' '}
                                {requirement.headcount}
                            </p>
                        )}
                        {filled > 0 && (
                            <p className="mt-0.5 text-xs text-stone-500 tabular-nums">
                                {acknowledged} of {filled} acknowledged
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <ul className="divide-y divide-stone-100">
                {requirement.assignments.map((row) => {
                    const removing = remove.isPending && remove.variables?.id === row.id;
                    const out = !holdsSpot(row);
                    const chip = row.status === 'assigned' ? null : assignmentStatuses[row.status];
                    const canChange =
                        editable && (row.status === 'assigned' || row.status === 'acknowledged');
                    return (
                        <li
                            key={row.id}
                            className="flex items-center gap-3 px-6 py-2.5 transition-colors hover:bg-stone-50"
                        >
                            <span
                                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${out ? 'bg-stone-100 text-stone-500' : 'bg-maroon-50 text-maroon-800'}`}
                                aria-hidden="true"
                            >
                                {initials(row.person.name)}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                    <p
                                        className={`truncate font-medium ${out ? 'text-stone-500' : 'text-stone-900'}`}
                                    >
                                        {row.person.name}
                                    </p>
                                    {chip && (
                                        <span
                                            className={`${chipClass} shrink-0 gap-1.5 ${chip.chip}`}
                                        >
                                            {row.status === 'on_duty' && (
                                                <span
                                                    className="size-1.5 animate-pulse rounded-full bg-ember-500"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            {chip.label}
                                        </span>
                                    )}
                                </div>
                                <p className="truncate text-sm text-stone-500">
                                    {row.person.email}
                                </p>
                                {row.override_reason && (
                                    <p
                                        className="mt-0.5 line-clamp-2 text-xs text-stone-600"
                                        title={row.override_reason}
                                    >
                                        <span className="font-semibold text-amber-900">
                                            Over headcount:
                                        </span>{' '}
                                        {row.override_reason}
                                    </p>
                                )}
                            </div>
                            {canChange && (
                                <div className="flex shrink-0 items-center gap-1">
                                    {started && (
                                        <button
                                            type="button"
                                            onClick={() => ask('no_show', row)}
                                            className={`${rowButton} text-stone-700 hover:bg-stone-100`}
                                            aria-label={`Mark ${row.person.name} as no show`}
                                        >
                                            No show
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        disabled={removing}
                                        onClick={() => {
                                            if (row.status === 'acknowledged') {
                                                ask('cancel', row);
                                            } else {
                                                onError(null);
                                                remove.mutate(row);
                                            }
                                        }}
                                        className={`${rowButton} text-red-700 hover:bg-red-50`}
                                        aria-label={`Remove ${row.person.name}`}
                                    >
                                        {removing ? 'Removing...' : 'Remove'}
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
                {open > 0 && (
                    <li>
                        {editable ? (
                            <button
                                type="button"
                                onClick={onPick}
                                className="group flex w-full items-center gap-3 px-6 py-2.5 text-left text-sm text-stone-600 transition-colors hover:bg-maroon-50"
                            >
                                <OpenSpot />
                                <span className="flex-1">{stillNeeded(open, labels)}</span>
                                <span className="font-semibold text-maroon-700 group-hover:underline">
                                    Fill a spot
                                </span>
                            </button>
                        ) : (
                            <p className="flex items-center gap-3 px-6 py-2.5 text-sm text-stone-500">
                                <OpenSpot />
                                {stillNeeded(open, labels)}
                            </p>
                        )}
                    </li>
                )}
            </ul>
            <ConfirmDialog
                open={action !== null}
                title={
                    action?.kind === 'no_show'
                        ? `Mark ${person} as no show?`
                        : `Take ${person} off this duty?`
                }
                description={
                    action?.kind === 'no_show'
                        ? `${firstName} did not report for ${dutyName(requirement)}. Their spot opens so you can fill it. This stays on their record.`
                        : `${firstName} already acknowledged ${dutyName(requirement)}. Say why, so the record shows it. They will see the duty as cancelled.`
                }
                confirmLabel={action?.kind === 'no_show' ? 'Mark no show' : 'Take off duty'}
                loadingLabel="Saving..."
                cancelLabel="Keep"
                tone="danger"
                loading={confirm.isPending}
                error={dialogError}
                confirmDisabled={action?.kind === 'cancel' && reason.trim().length < 5}
                onConfirm={() => {
                    if (action) confirm.mutate(action);
                }}
                onCancel={() => setAction(null)}
            >
                {action?.kind === 'cancel' && (
                    <ReasonField
                        id={`cancel-reason-${requirement.id}`}
                        value={reason}
                        onChange={setReason}
                        hint="At least 5 characters. It is kept in the audit log."
                    />
                )}
            </ConfirmDialog>
        </li>
    );
}

interface AssignProps {
    role: Role;
    // Every duty for this role. A full one can still take a person, with a reason.
    duties: Requirement[];
    dutyId: string;
    onPick: (id: string) => void;
    // Goes up by one each time "Fill a spot" is clicked, to bring the person list into focus.
    focusRequest: number;
}

// Pick the duty, then the person. "Fill a spot" on a duty picks it here.
function AssignForm({ role, duties, dutyId, onPick, focusRequest }: AssignProps) {
    const queryClient = useQueryClient();
    const labels = roleLabels[role];
    const [userId, setUserId] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const duty = duties.find((r) => String(r.id) === dutyId);
    const full = duty !== undefined && spotsTaken(duty) >= duty.headcount;

    const candidates = useQuery({
        queryKey: ['requirement-candidates', Number(dutyId)],
        queryFn: () => listCandidates(Number(dutyId)),
        enabled: dutyId !== '',
    });

    const add = useMutation({
        mutationFn: () =>
            assignPerson(Number(dutyId), Number(userId), full ? reason.trim() : undefined),
        onSuccess: () => {
            setUserId('');
            setReason('');
            return Promise.all([
                queryClient.invalidateQueries({ queryKey: ['event'] }),
                queryClient.invalidateQueries({ queryKey: ['requirement-candidates'] }),
            ]);
        },
        onError: (failure) => setError(failMessage(failure)),
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        if (dutyId && userId) add.mutate();
    }

    const options = (candidates.data ?? []).filter((person) => person.role === role);
    const free = options.filter((person) => person.conflict === null);
    const ready = candidates.isSuccess;

    useEffect(() => {
        if (focusRequest === 0) return;
        const field = document.getElementById(`${role}-person`);
        field?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        if (ready) field?.focus({ preventScroll: true });
    }, [focusRequest, ready, role]);

    const personPlaceholder = !dutyId
        ? 'Choose a duty first'
        : !candidates.isSuccess
          ? 'Loading people...'
          : free.length
            ? 'Choose a person'
            : `No ${labels.plural.toLowerCase()} free to add`;

    return (
        <form
            onSubmit={submit}
            className="space-y-3 rounded-b-card border-t border-stone-200 bg-stone-50 px-6 py-4"
        >
            <h3 className="text-sm font-semibold text-stone-900">Add a {labels.one}</h3>
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <SelectField
                    id={`${role}-duty`}
                    label="Duty"
                    size="md"
                    placeholder="Choose a duty"
                    value={dutyId}
                    onChange={(e) => {
                        onPick(e.target.value);
                        setUserId('');
                        setError(null);
                    }}
                >
                    {duties.map((r) => {
                        const left = r.headcount - spotsTaken(r);
                        return (
                            <SelectOption key={r.id} value={r.id}>
                                {dutyName(r)} ({left > 0 ? `${left} open` : 'full'})
                            </SelectOption>
                        );
                    })}
                </SelectField>
                <SelectField
                    id={`${role}-person`}
                    label="Person"
                    size="md"
                    placeholder={personPlaceholder}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    disabled={!dutyId || !candidates.isSuccess || free.length === 0}
                >
                    {options.map((person) => (
                        <SelectOption
                            key={person.id}
                            value={person.id}
                            disabled={person.conflict !== null}
                        >
                            {person.conflict
                                ? `${person.name} (busy: ${person.conflict})`
                                : person.name}
                        </SelectOption>
                    ))}
                </SelectField>
                <Button
                    type="submit"
                    size="md"
                    loading={add.isPending}
                    disabled={!dutyId || !userId || (full && reason.trim().length < 5)}
                >
                    {add.isPending ? 'Assigning...' : full ? 'Assign anyway' : 'Assign'}
                </Button>
            </div>
            {full && (
                <div className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">This duty is full.</p>
                    <p className="mt-0.5 text-sm text-stone-700">
                        You can still add one more person. Say why, so the record shows it.
                    </p>
                    <div className="mt-3">
                        <ReasonField
                            id={`${role}-override`}
                            label="Reason to go over the headcount"
                            value={reason}
                            onChange={setReason}
                            hint="At least 5 characters. It is kept in the audit log."
                        />
                    </div>
                </div>
            )}
            {error && <Alert tone="error">{error}</Alert>}
        </form>
    );
}

// Local date and time input value to an exact moment for the server.
const toUtc = (value: string) => (value ? new Date(value).toISOString() : '');

// Exact moment to a local "YYYY-MM-DDTHH:mm" value for a datetime-local input.
function toLocalInput(iso: string) {
    const date = new Date(iso);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}

interface AddProps {
    event: EventSummary;
    role: Role;
    taskTypes: Option[];
    onClose: () => void;
}

// Step 2 of adding a duty: tick the people for it, in the same card.
function PickPeople({ requirement, onDone }: { requirement: Requirement; onDone: () => void }) {
    const queryClient = useQueryClient();
    const labels = roleLabels[requirement.role];
    const limit = requirement.headcount;
    const headingId = `pick-${requirement.id}-heading`;
    const [chosen, setChosen] = useState<number[]>([]);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);

    const candidates = useQuery({
        queryKey: ['requirement-candidates', requirement.id],
        queryFn: () => listCandidates(requirement.id),
    });

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ['event'] }),
            queryClient.invalidateQueries({ queryKey: ['requirement-candidates'] }),
        ]);

    const assign = useMutation({
        mutationFn: async () => {
            for (const userId of chosen) {
                await assignPerson(requirement.id, userId);
            }
        },
        onSuccess: async () => {
            await refresh();
            onDone();
        },
        onError: async (failure) => {
            setError(failMessage(failure));
            setChosen([]);
            await refresh();
        },
    });

    const people = (candidates.data ?? []).filter((person) => person.role === requirement.role);
    const term = search.trim().toLowerCase();
    const shown = term
        ? people.filter((person) => person.name.toLowerCase().includes(term))
        : people;
    const full = chosen.length >= limit;

    function toggle(id: number) {
        setError(null);
        setChosen((list) =>
            list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
        );
    }

    return (
        <div
            role="group"
            aria-labelledby={headingId}
            className="border-b border-stone-200 bg-white"
        >
            <div className="px-6 pt-5">
                <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                    Step 2 of 2
                </p>
                <h3 id={headingId} className="mt-1 font-semibold text-stone-900">
                    Who will do {dutyName(requirement)}?
                </h3>
                <p className="mt-0.5 text-sm text-stone-600 tabular-nums" aria-live="polite">
                    Pick up to {limit}. {chosen.length} of {limit} picked.
                </p>
            </div>

            <div className="space-y-3 px-6 py-4">
                {people.length > 6 && (
                    <TextField
                        id={`${headingId}-search`}
                        label="Search names"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                )}

                {candidates.isPending && (
                    <div className="space-y-2" aria-busy="true">
                        <p role="status" className="sr-only">
                            Loading people...
                        </p>
                        {[0, 1, 2].map((row) => (
                            <div
                                key={row}
                                className="h-12 animate-pulse rounded-control bg-stone-200"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                )}

                {candidates.isError && (
                    <div className="space-y-3">
                        <Alert tone="error">The people list did not load.</Alert>
                        <Button
                            variant="secondary"
                            size="md"
                            loading={candidates.isFetching}
                            onClick={() => void candidates.refetch()}
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {candidates.isSuccess && people.length === 0 && (
                    <p className="rounded-control bg-stone-50 px-4 py-3 text-sm text-stone-600">
                        No {labels.plural.toLowerCase()} left to add. Everyone active is already on
                        this event.
                    </p>
                )}

                {candidates.isSuccess && people.length > 0 && (
                    <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-control ring-1 ring-stone-200">
                        {shown.map((person) => {
                            const checked = chosen.includes(person.id);
                            const busy = person.conflict !== null;
                            const disabled = (!checked && full) || busy;
                            return (
                                <li key={person.id}>
                                    <label
                                        className={`flex min-h-12 items-center gap-3 px-4 py-2 transition-colors ${checked ? 'bg-maroon-50' : ''} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-stone-50'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={disabled || assign.isPending}
                                            onChange={() => toggle(person.id)}
                                            className="size-4 shrink-0 accent-maroon-700"
                                        />
                                        <span
                                            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${disabled ? 'bg-stone-100 text-stone-500' : 'bg-maroon-50 text-maroon-800'}`}
                                            aria-hidden="true"
                                        >
                                            {initials(person.name)}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span
                                                className={`block truncate font-medium ${disabled ? 'text-stone-500' : 'text-stone-900'}`}
                                            >
                                                {person.name}
                                            </span>
                                            {busy && (
                                                <span className="block truncate text-xs text-stone-600">
                                                    On duty at {person.conflict} at this time
                                                </span>
                                            )}
                                        </span>
                                        {busy && (
                                            <span className={`${chipClass} shrink-0 ${busyChip}`}>
                                                Busy
                                            </span>
                                        )}
                                    </label>
                                </li>
                            );
                        })}
                        {shown.length === 0 && (
                            <li className="px-4 py-3 text-sm text-stone-500">
                                No names match that search.
                            </li>
                        )}
                    </ul>
                )}
            </div>

            <div className="space-y-3 px-6 pb-5">
                {error && <Alert tone="error">{error}</Alert>}
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        disabled={assign.isPending}
                        onClick={onDone}
                    >
                        {chosen.length ? 'Cancel' : 'Skip for now'}
                    </Button>
                    <Button
                        type="button"
                        size="md"
                        loading={assign.isPending}
                        disabled={chosen.length === 0}
                        onClick={() => {
                            setError(null);
                            assign.mutate();
                        }}
                    >
                        {assign.isPending
                            ? 'Assigning...'
                            : chosen.length
                              ? `Assign ${chosen.length} ${chosen.length === 1 ? labels.one : labels.plural.toLowerCase()}`
                              : 'Assign'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// A new duty for one role. The shift starts as the whole event, so most duties need no time change.
function AddDuty({ event, role, taskTypes, onClose }: AddProps) {
    const queryClient = useQueryClient();
    const labels = roleLabels[role];
    const eventStart = toLocalInput(event.starts_at);
    const eventEnd = toLocalInput(event.ends_at);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [dutyTypeId, setDutyTypeId] = useState('');
    const [team, setTeam] = useState('');
    const [headcount, setHeadcount] = useState('1');
    const [startsAt, setStartsAt] = useState(eventStart);
    const [endsAt, setEndsAt] = useState(eventEnd);
    const [instructions, setInstructions] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [created, setCreated] = useState<Requirement | null>(null);
    const prefix = `${role}-new`;

    const save = useMutation({
        mutationFn: () =>
            createRequirement(event.id, {
                duty_type_id: Number(dutyTypeId),
                role,
                team_needed: team,
                headcount: Number(headcount),
                shift_starts_at: toUtc(startsAt),
                shift_ends_at: toUtc(endsAt),
                instructions,
            }),
        onSuccess: async (requirement) => {
            setCreated(requirement);
            await queryClient.invalidateQueries({ queryKey: ['event', event.id] });
        },
        onError: (failure) => {
            const body =
                failure instanceof ApiError
                    ? (failure.body as { errors?: Record<string, string[]> } | null)
                    : null;
            if (failure instanceof ApiError && failure.status === 422 && body?.errors) {
                setErrors(body.errors);
            } else {
                setFormError('That did not work. Check your connection and try again.');
            }
        },
    });

    const first = (key: string) => errors[key]?.[0] ?? null;
    const instructionsError = first('instructions') ?? first('role');

    function submit(e: FormEvent) {
        e.preventDefault();
        setErrors({});
        setFormError(null);
        save.mutate();
    }

    if (created) return <PickPeople requirement={created} onDone={onClose} />;

    return (
        <form
            onSubmit={submit}
            aria-labelledby={`${prefix}-heading`}
            className="@container border-b border-stone-200 bg-white"
        >
            <div className="px-4 pt-5 @md:px-6">
                <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                    Step 1 of 2
                </p>
                <h3 id={`${prefix}-heading`} className="mt-1 font-semibold text-stone-900">
                    New {labels.one} duty
                </h3>
                <p className="mt-0.5 text-sm text-stone-600">
                    Say what is needed. Next, you pick the people.
                </p>
            </div>
            <div className={`grid gap-4 px-4 py-5 @md:px-6 @lg:grid-cols-2 ${pickerClass}`}>
                <div className="@lg:col-span-2">
                    <SelectField
                        id={`${prefix}-type`}
                        label="Duty type"
                        size="md"
                        placeholder="Choose a duty"
                        value={dutyTypeId}
                        onChange={(e) => setDutyTypeId(e.target.value)}
                        error={first('duty_type_id')}
                        required
                    >
                        {taskTypes.map((task) => (
                            <SelectOption key={task.id} value={task.id}>
                                {task.name}
                            </SelectOption>
                        ))}
                    </SelectField>
                </div>
                <div className="grid grid-cols-[1fr_6rem] gap-3 @lg:col-span-2 @lg:grid-cols-[1fr_8rem]">
                    <TextField
                        id={`${prefix}-team`}
                        label="Station (optional)"
                        value={team}
                        onChange={(e) => setTeam(e.target.value)}
                        error={first('team_needed')}
                        placeholder="Gate A"
                        maxLength={100}
                    />
                    <TextField
                        id={`${prefix}-headcount`}
                        label="People"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={headcount}
                        onChange={(e) => setHeadcount(e.target.value)}
                        error={first('headcount')}
                        required
                    />
                </div>
                <TextField
                    id={`${prefix}-starts`}
                    label="Shift starts"
                    type="datetime-local"
                    value={startsAt}
                    min={eventStart}
                    max={eventEnd}
                    onChange={(e) => setStartsAt(e.target.value)}
                    error={first('shift_starts_at')}
                    required
                />
                <TextField
                    id={`${prefix}-ends`}
                    label="Shift ends"
                    type="datetime-local"
                    value={endsAt}
                    min={startsAt || eventStart}
                    max={eventEnd}
                    onChange={(e) => setEndsAt(e.target.value)}
                    error={first('shift_ends_at')}
                    hint={duration(startsAt, endsAt) ?? 'Must sit inside the event time.'}
                    required
                />
                <div className="@lg:col-span-2">
                    <label
                        htmlFor={`${prefix}-instructions`}
                        className="mb-1.5 block text-sm font-medium text-stone-800"
                    >
                        Instructions <span className="font-normal text-stone-500">(optional)</span>
                    </label>
                    <textarea
                        id={`${prefix}-instructions`}
                        rows={2}
                        maxLength={2000}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Where to report, what to bring, who to call."
                        aria-invalid={instructionsError ? true : undefined}
                        aria-describedby={
                            instructionsError ? `${prefix}-instructions-error` : undefined
                        }
                        className={`${controlClass(Boolean(instructionsError))} min-h-20 resize-y py-2.5 leading-relaxed`}
                    />
                    {instructionsError && (
                        <p
                            id={`${prefix}-instructions-error`}
                            className="mt-1.5 text-sm font-medium text-red-700"
                        >
                            {instructionsError}
                        </p>
                    )}
                </div>
            </div>
            <div className="space-y-3 px-4 pb-5 @md:px-6">
                {formError && <Alert tone="error">{formError}</Alert>}
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <Button type="button" variant="secondary" size="md" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" size="md" loading={save.isPending}>
                        {save.isPending ? 'Saving...' : 'Save and pick people'}
                    </Button>
                </div>
            </div>
        </form>
    );
}

interface ColumnProps {
    event: EventSummary;
    role: Role;
    requirements: Requirement[];
    editable: boolean;
    taskTypes: Option[] | undefined;
}

// Marshals or Volunteers: every duty and every person for that role on one card.
function RoleColumn({ event, role, requirements, editable, taskTypes }: ColumnProps) {
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState('');
    const [focusRequest, setFocusRequest] = useState(0);
    const labels = roleLabels[role];
    const openDuties = requirements.filter((r) => spotsTaken(r) < r.headcount);
    // A picked duty stays picked, even when full. Otherwise use the only open one, or none.
    const dutyId =
        picked && requirements.some((r) => String(r.id) === picked)
            ? picked
            : openDuties.length === 1
              ? String(openDuties[0].id)
              : '';
    const headingId = `${role}-heading`;
    const needed = requirements.reduce((sum, r) => sum + r.headcount, 0);
    const assigned = requirements.reduce((sum, r) => sum + Math.min(spotsTaken(r), r.headcount), 0);
    const canAdd = editable && taskTypes !== undefined;
    const percent = needed ? Math.round((assigned / needed) * 100) : 0;

    return (
        <section
            aria-labelledby={headingId}
            className="flex flex-col rounded-card bg-white ring-1 ring-stone-200"
        >
            <header className="px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h2 id={headingId} className="text-lg font-semibold text-stone-900">
                            {labels.plural}
                        </h2>
                        <p className="text-sm text-stone-600 tabular-nums">
                            {requirements.length === 0
                                ? 'No duties yet'
                                : `${requirements.length} ${requirements.length === 1 ? 'duty' : 'duties'}, ${needed - assigned === 0 ? 'all spots filled' : `${needed - assigned} ${needed - assigned === 1 ? 'spot' : 'spots'} open`}`}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                        {needed > 0 && (
                            <p className="text-right text-sm text-stone-600 tabular-nums">
                                <span className="text-2xl font-semibold tracking-tight text-stone-900">
                                    {assigned}
                                </span>{' '}
                                / {needed}
                            </p>
                        )}
                        {canAdd && !adding && (
                            <Button variant="secondary" size="md" onClick={() => setAdding(true)}>
                                <PlusIcon className="size-4" />
                                Add duty
                            </Button>
                        )}
                    </div>
                </div>
                {needed > 0 && (
                    <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"
                        role="progressbar"
                        aria-label={`${labels.plural} assigned`}
                        aria-valuemin={0}
                        aria-valuemax={needed}
                        aria-valuenow={assigned}
                    >
                        <div
                            className={`h-full rounded-full transition-[width] duration-200 ${assigned === needed ? 'bg-green-700' : 'bg-maroon-700'}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                )}
            </header>

            {adding && taskTypes && (
                <div className="border-t border-stone-200">
                    <AddDuty
                        event={event}
                        role={role}
                        taskTypes={taskTypes}
                        onClose={() => setAdding(false)}
                    />
                </div>
            )}

            {requirements.length === 0 ? (
                !adding && (
                    <div className="flex flex-1 flex-col items-center border-t border-stone-200 px-6 py-10 text-center">
                        <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                            <PeopleIcon className="size-5" />
                        </span>
                        <p className="mt-3 font-medium text-stone-900">
                            No {labels.one} duties yet
                        </p>
                        <p className="mt-0.5 text-sm text-stone-600">
                            {editable
                                ? 'Add a duty, then assign people to it.'
                                : `This event had no ${labels.plural.toLowerCase()}.`}
                        </p>
                    </div>
                )
            ) : (
                <ul className="flex-1">
                    {requirements.map((requirement) => (
                        <DutyGroup
                            key={requirement.id}
                            requirement={requirement}
                            editable={editable}
                            selected={String(requirement.id) === dutyId}
                            onPick={() => {
                                setPicked(String(requirement.id));
                                setFocusRequest((n) => n + 1);
                            }}
                            onError={setError}
                        />
                    ))}
                </ul>
            )}

            {error && (
                <div className="border-t border-stone-200 px-6 py-3">
                    <Alert tone="error">{error}</Alert>
                </div>
            )}

            {editable && requirements.length > 0 && (
                <AssignForm
                    role={role}
                    duties={requirements}
                    dutyId={dutyId}
                    onPick={setPicked}
                    focusRequest={focusRequest}
                />
            )}
        </section>
    );
}

function Skeleton() {
    return (
        <div className="mx-auto max-w-[1440px]" aria-busy="true">
            <BackLink />
            <p className="sr-only" role="status">
                Loading the event...
            </p>
            <div className="mt-4 h-1 w-12 rounded-full bg-stone-200" aria-hidden="true" />
            <div className="mt-4 h-7 w-80 animate-pulse rounded bg-stone-200" aria-hidden="true" />
            <div className="mt-4 flex gap-6" aria-hidden="true">
                <div className="h-4 w-28 animate-pulse rounded bg-stone-200" />
                <div className="h-4 w-36 animate-pulse rounded bg-stone-200" />
                <div className="h-4 w-56 animate-pulse rounded bg-stone-200" />
            </div>
            <div className="mt-8 grid gap-6 xl:grid-cols-2" aria-hidden="true">
                {[0, 1].map((card) => (
                    <div key={card} className="rounded-card bg-white p-6 ring-1 ring-stone-200">
                        <div className="h-5 w-28 animate-pulse rounded bg-stone-200" />
                        <div className="mt-6 space-y-4">
                            <div className="h-9 animate-pulse rounded bg-stone-200" />
                            <div className="h-9 animate-pulse rounded bg-stone-200" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EventActions({ event }: { event: EventSummary }) {
    const queryClient = useQueryClient();
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const done = async () => {
        setConfirmCancel(false);
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['event', event.id] }),
            queryClient.invalidateQueries({ queryKey: ['events'] }),
        ]);
    };
    const failed = () => setError('That did not work. Refresh the page and try again.');
    const publish = useMutation({
        mutationFn: () => publishEvent(event.id),
        onSuccess: done,
        onError: failed,
    });
    const cancel = useMutation({
        mutationFn: () => cancelEvent(event.id),
        onSuccess: done,
        onError: failed,
    });

    if (event.status !== 'draft' && event.status !== 'published') return null;

    return (
        <div className="flex max-w-sm flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        setConfirmCancel(true);
                    }}
                    className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
                >
                    Cancel event
                </button>
                <Link
                    to={`/admin/events/${event.id}/edit`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-control border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 active:bg-stone-100"
                >
                    <PencilIcon className="size-4 text-stone-500" />
                    Edit event
                </Link>
                {event.status === 'draft' && (
                    <Button
                        size="md"
                        loading={publish.isPending}
                        onClick={() => {
                            setError(null);
                            publish.mutate();
                        }}
                    >
                        {publish.isPending ? 'Publishing...' : 'Publish event'}
                    </Button>
                )}
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <ConfirmDialog
                open={confirmCancel}
                title="Cancel this event?"
                description="Assigned people will see the event as cancelled. This cannot be undone."
                confirmLabel="Cancel event"
                cancelLabel="Keep event"
                tone="danger"
                loading={cancel.isPending}
                loadingLabel="Cancelling..."
                onConfirm={() => cancel.mutate()}
                onCancel={() => setConfirmCancel(false)}
            />
        </div>
    );
}

export function EventDetail() {
    const eventId = Number(useParams().id);

    const event = useQuery({ queryKey: ['event', eventId], queryFn: () => getEvent(eventId) });
    const lookups = useQuery({ queryKey: ['event-lookups'], queryFn: getLookups });

    if (event.isPending) return <Skeleton />;

    if (event.isError) {
        const missing = event.error instanceof ApiError && event.error.status === 404;
        return (
            <div className="mx-auto max-w-[1440px]">
                <BackLink />
                <div className="mt-6 max-w-xl space-y-3">
                    <Alert tone="error">
                        {missing
                            ? 'This event does not exist or was removed.'
                            : 'The event did not load. Check your connection and try again.'}
                    </Alert>
                    {!missing && (
                        <Button
                            variant="secondary"
                            size="md"
                            loading={event.isFetching}
                            onClick={() => void event.refetch()}
                        >
                            {event.isFetching ? 'Retrying...' : 'Retry'}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    const data = event.data;
    const requirements: Requirement[] = data.requirements ?? [];
    const status = statuses[data.status];
    const when = schedule(data.starts_at, data.ends_at);
    const editable = data.status === 'draft' || data.status === 'published';

    return (
        <div className="mx-auto max-w-[1440px]">
            <BackLink />

            <header className="mt-4 flex flex-col gap-x-10 gap-y-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight text-balance text-stone-900">
                            {data.title}
                        </h1>
                        <span className={`${chipClass} ${status.chip}`}>{status.label}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                        <Meta icon={<TagIcon className="size-4" />}>{data.event_type.label}</Meta>
                        <Meta icon={<PinIcon className="size-4" />}>
                            {data.location?.name ?? 'No location set'}
                        </Meta>
                        <Meta icon={<CalendarIcon className="size-4" />}>
                            <span className="tabular-nums">
                                {when.day}, {when.time}
                            </span>
                        </Meta>
                    </div>
                    {data.description && (
                        <p className="mt-4 max-w-3xl text-pretty whitespace-pre-line text-stone-700">
                            {data.description}
                        </p>
                    )}
                </div>
                <EventActions event={data} />
            </header>

            {data.status === 'cancelled' && (
                <div className="mt-6 max-w-3xl">
                    <Alert tone="warning">
                        This event was cancelled. Its duties and people are kept for the record and
                        can no longer change.
                    </Alert>
                </div>
            )}

            {data.status === 'completed' && (
                <div className="mt-6 max-w-3xl">
                    <Alert tone="info">
                        This event is completed. Its duties and people are kept for the record.
                    </Alert>
                </div>
            )}

            {data.status === 'draft' && (
                <div className="mt-6 max-w-3xl">
                    <Alert tone="info">
                        This event is a draft. Assigned people see their duties after you publish
                        it.
                    </Alert>
                </div>
            )}

            {lookups.isError && editable && (
                <div className="mt-6 flex max-w-2xl flex-wrap items-start gap-3">
                    <div className="flex-1">
                        <Alert tone="error">
                            The duty types did not load, so you cannot add duties yet.
                        </Alert>
                    </div>
                    <Button
                        variant="secondary"
                        size="md"
                        loading={lookups.isFetching}
                        onClick={() => void lookups.refetch()}
                    >
                        Retry
                    </Button>
                </div>
            )}

            <div className="mt-8 grid items-start gap-6 xl:grid-cols-2">
                {(['marshal', 'volunteer'] as const).map((role) => (
                    <RoleColumn
                        key={role}
                        event={data}
                        role={role}
                        requirements={requirements.filter((r) => r.role === role)}
                        editable={editable}
                        taskTypes={lookups.data?.task_types}
                    />
                ))}
            </div>
        </div>
    );
}

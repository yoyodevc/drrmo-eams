// A-Manage lists. Admin adds, renames, deactivates and removes the values used on the person form,
// the people filters and the event form: teams, departments, event types and campus locations.
// A value that is still in use can be set inactive, not deleted.
// Desktop: a list switcher on the left and the chosen list on the right. Phones: a switcher row on top.
// Locations also show on a campus map, and the add and edit dialog has a pin picker.
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMe } from '@/app/auth';
import {
    deleteEventType,
    deleteLocation,
    listEventTypes,
    listLocations,
    saveEventType,
    saveLocation,
} from '@/features/events/api';
import { parseCoords } from '@/features/monitoring/mapView';
import { LocationPicker, LocationsOverview } from '@/features/personnel/components/LocationMaps';
import {
    EditIcon,
    PlusIcon,
    SearchIcon,
    TrashIcon,
    chipBase,
} from '@/features/personnel/components/ui';
import {
    deleteOrgUnit,
    errorMessage,
    fieldErrors,
    listDepartments,
    listTeams,
    saveOrgUnit,
} from '@/features/personnel/people';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { TextField } from '@/shared/ui/TextField';

type ListKind = 'teams' | 'departments' | 'event-types' | 'locations';
type Status = 'all' | 'active' | 'inactive';

interface Unit {
    key: string | number;
    name: string;
    active: boolean;
    count: number;
    latitude?: number;
    longitude?: number;
}

const copy: Record<
    ListKind,
    {
        title: string;
        one: string;
        about: string;
        example: string;
        filter: string | null;
        noun: [string, string];
        usedBy: string;
        group: 'People' | 'Events';
    }
> = {
    teams: {
        title: 'Teams',
        one: 'team',
        about: 'The duty group a person works in. Shown on the person form and the People filters.',
        example: 'For example, Traffic control.',
        filter: 'team',
        noun: ['person', 'people'],
        usedBy: 'People',
        group: 'People',
    },
    departments: {
        title: 'Departments',
        one: 'department',
        about: 'The college or office a person belongs to. Shown on the person form and the People filters.',
        example: 'For example, College of Nursing.',
        filter: 'department',
        noun: ['person', 'people'],
        usedBy: 'People',
        group: 'People',
    },
    'event-types': {
        title: 'Event types',
        one: 'event type',
        about: 'The kind of event. Shown on the event form and the Events filter.',
        example: 'For example, Outreach.',
        filter: null,
        noun: ['event', 'events'],
        usedBy: 'Events',
        group: 'Events',
    },
    locations: {
        title: 'Locations',
        one: 'location',
        about: 'The campus places an event can happen at. Each has a pin on the campus map.',
        example: 'For example, ZPPSU Gymnasium.',
        filter: null,
        noun: ['event', 'events'],
        usedBy: 'Events',
        group: 'Events',
    },
};

const iconButton =
    'inline-flex size-12 items-center justify-center rounded-control text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200 md:size-10';

// Name, status, used by, actions. Columns appear only when the panel itself is wide enough
// (a container query), so a narrow panel never squeezes the name into one letter per line.
const rowGrid =
    '@xl:grid @xl:grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_5.5rem] @xl:items-center @xl:gap-4';

function count(n: number, kind: ListKind) {
    const [one, many] = copy[kind].noun;
    return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

function useList(kind: ListKind, enabled = true) {
    return useQuery({
        queryKey: [kind],
        enabled,
        queryFn: async (): Promise<Unit[]> => {
            if (kind === 'teams')
                return (await listTeams()).map((t) => ({
                    ...t,
                    key: t.code,
                    count: t.people_count,
                }));
            if (kind === 'departments')
                return (await listDepartments()).map((d) => ({
                    ...d,
                    key: d.id,
                    count: d.people_count,
                }));
            if (kind === 'event-types')
                return (await listEventTypes()).map((t) => ({
                    ...t,
                    key: t.code,
                    count: t.events_count,
                }));
            return (await listLocations()).map((l) => ({
                ...l,
                key: l.id,
                count: l.events_count,
            }));
        },
    });
}

function ListIcon({ kind, className = 'size-5' }: { kind: ListKind; className?: string }) {
    const paths: Record<ListKind, ReactNode> = {
        teams: (
            <>
                <circle cx="9" cy="8" r="3" />
                <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
                <path d="M15.5 5.5a3 3 0 0 1 0 5.5M17.5 14.5a5.5 5.5 0 0 1 3 4.5" />
            </>
        ),
        departments: (
            <>
                <path d="M3 20h18M5 20V9l7-4 7 4v11" />
                <path d="M9 20v-5h6v5M9 11h.01M15 11h.01" />
            </>
        ),
        'event-types': (
            <>
                <path d="M4 7.5V4.5h7l9 9-6.5 6.5-9-9z" />
                <circle cx="8" cy="8" r="1.2" />
            </>
        ),
        locations: (
            <>
                <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
            </>
        ),
    };
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[kind]}
        </svg>
    );
}

function SkeletonRows() {
    return (
        <ul aria-hidden="true" className="divide-y divide-stone-100">
            {[0, 1, 2, 3, 4].map((row) => (
                <li key={row} className="flex items-center gap-4 px-4 py-4 md:px-6">
                    <div className="flex-1">
                        <div className="h-4 w-48 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-stone-200 @xl:hidden" />
                    </div>
                    <div className="hidden h-4 w-16 animate-pulse rounded bg-stone-200 @xl:block" />
                    <div className="hidden h-4 w-20 animate-pulse rounded bg-stone-200 @xl:block" />
                    <div className="h-8 w-20 animate-pulse rounded bg-stone-200" />
                </li>
            ))}
        </ul>
    );
}

function StatusChip({ active }: { active: boolean }) {
    return active ? (
        <span className={`${chipBase} bg-green-50 text-green-800 ring-green-200`}>Active</span>
    ) : (
        <span className={`${chipBase} bg-stone-100 text-stone-600 ring-stone-200`}>Inactive</span>
    );
}

function ListPanel({ kind, list }: { kind: ListKind; list: UseQueryResult<Unit[]> }) {
    const c = copy[kind];
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isLocation = kind === 'locations';

    // editing: null = closed, 'new' = add dialog, else the unit being edited.
    const [editing, setEditing] = useState<Unit | 'new' | null>(null);
    const [name, setName] = useState('');
    const [active, setActive] = useState(true);
    const [coords, setCoords] = useState({ latitude: '', longitude: '' });
    const [removing, setRemoving] = useState<Unit | null>(null);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<Status>('all');
    const [focused, setFocused] = useState<string | number | null>(null);

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: [kind] }),
            queryClient.invalidateQueries({ queryKey: ['people'] }),
            queryClient.invalidateQueries({ queryKey: ['event-lookups'] }),
            queryClient.invalidateQueries({ queryKey: ['events'] }),
        ]);
    const save = useMutation({
        mutationFn: (input: {
            key: string | number | null;
            name: string;
            active: boolean;
            latitude?: number;
            longitude?: number;
        }) => {
            const body = { name: input.name, active: input.active };
            if (kind === 'event-types')
                return saveEventType(input.key === null ? null : String(input.key), body);
            if (kind === 'locations')
                return saveLocation(input.key === null ? null : Number(input.key), {
                    ...body,
                    latitude: input.latitude ?? 0,
                    longitude: input.longitude ?? 0,
                });
            return saveOrgUnit(kind, input.key, body);
        },
        onSuccess: async () => {
            await refresh();
            setEditing(null);
            setRemoving(null);
        },
    });
    const remove = useMutation({
        mutationFn: (unit: Unit) => {
            if (kind === 'event-types') return deleteEventType(String(unit.key));
            if (kind === 'locations') return deleteLocation(Number(unit.key));
            return deleteOrgUnit(kind, unit.key);
        },
        onSuccess: async () => {
            await refresh();
            setRemoving(null);
        },
    });

    function open(unit: Unit | 'new') {
        save.reset();
        setName(unit === 'new' ? '' : unit.name);
        setActive(unit === 'new' ? true : unit.active);
        setCoords({
            latitude: unit === 'new' ? '' : String(unit.latitude ?? ''),
            longitude: unit === 'new' ? '' : String(unit.longitude ?? ''),
        });
        setEditing(unit);
    }

    const point = parseCoords(coords.latitude, coords.longitude);
    const coordsMissing = isLocation && point === null;
    const onCoords = useCallback(
        (latitude: string, longitude: string) => setCoords({ latitude, longitude }),
        [],
    );

    function submit(e?: FormEvent) {
        e?.preventDefault();
        if (name.trim() === '' || coordsMissing || save.isPending) return;
        save.mutate({
            key: editing === 'new' || editing === null ? null : editing.key,
            name: name.trim(),
            active,
            latitude: point?.[0],
            longitude: point?.[1],
        });
    }

    const errors = fieldErrors(save.error);
    const units = list.data ?? [];
    const activeCount = units.filter((u) => u.active).length;
    const q = query.trim().toLowerCase();
    const shown = units.filter(
        (u) =>
            (status === 'all' || u.active === (status === 'active')) &&
            (q === '' || u.name.toLowerCase().includes(q)),
    );
    const peopleLink = (u: Unit) =>
        c.filter ? `/admin/people?${c.filter}=${encodeURIComponent(u.key)}` : null;

    // A unit in use cannot be deleted. The dialog says why and offers the next best step.
    const inUse = removing !== null && removing.count > 0;
    const verb = removing?.count === 1 ? 'is' : 'are';
    let removeDialog: {
        title: string;
        description: string;
        confirm: string;
        loading: string;
        tone: 'primary' | 'danger';
        run: () => void;
    } | null = null;
    if (removing && !inUse) {
        removeDialog = {
            title: `Delete ${removing.name}?`,
            description: `Nothing uses this ${c.one}. Deleting it removes it from every list. You cannot undo this.`,
            confirm: 'Delete',
            loading: 'Deleting...',
            tone: 'danger',
            run: () => remove.mutate(removing),
        };
    } else if (removing && removing.active) {
        removeDialog = {
            title: `${removing.name} is still in use`,
            description: `${count(removing.count, kind)} ${verb} ${c.filter ? 'in' : 'using'} this ${c.one}, so it cannot be deleted. Set it inactive to hide it from the choices for new entries. Existing ones keep it.`,
            confirm: 'Set inactive',
            loading: 'Saving...',
            tone: 'primary',
            run: () =>
                save.mutate({
                    key: removing.key,
                    name: removing.name,
                    active: false,
                    latitude: removing.latitude,
                    longitude: removing.longitude,
                }),
        };
    } else if (removing) {
        removeDialog = {
            title: `${removing.name} is still in use`,
            description: `${count(removing.count, kind)} ${verb} still on this ${c.one}, so it cannot be deleted yet. Move ${removing.count === 1 ? 'it' : 'them'} to another ${c.one} first.`,
            confirm: peopleLink(removing) ? 'View people' : 'OK',
            loading: 'Opening...',
            tone: 'primary',
            run: () => {
                const link = peopleLink(removing);
                if (link) navigate(link);
                else setRemoving(null);
            },
        };
    }

    const grid = rowGrid;

    let body: ReactNode;
    if (list.isPending) {
        body = <SkeletonRows />;
    } else if (list.isError) {
        body = (
            <div className="space-y-3 px-4 py-6 md:px-6">
                <Alert tone="error">
                    The {c.title.toLowerCase()} did not load. Check your connection and try again.
                </Alert>
                <Button
                    variant="secondary"
                    size="md"
                    loading={list.isFetching}
                    onClick={() => void list.refetch()}
                >
                    {list.isFetching ? 'Retrying...' : 'Retry'}
                </Button>
            </div>
        );
    } else if (units.length === 0) {
        body = (
            <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="grid size-11 place-items-center rounded-control text-stone-500 ring-1 ring-stone-200">
                    <ListIcon kind={kind} />
                </span>
                <p className="mt-4 font-medium text-stone-900">No {c.title.toLowerCase()} yet.</p>
                <p className="mt-1 max-w-sm text-sm text-pretty text-stone-500">
                    Add the first {c.one} so it can be picked on the forms.
                </p>
                <Button variant="secondary" size="md" className="mt-5" onClick={() => open('new')}>
                    <PlusIcon className="size-4" />
                    Add {c.one}
                </Button>
            </div>
        );
    } else if (shown.length === 0) {
        body = (
            <div className="px-6 py-12 text-center">
                <p className="font-medium text-stone-900">
                    No {status === 'all' ? '' : `${status} `}
                    {c.title.toLowerCase()}
                    {q ? ` match "${query.trim()}"` : ''}.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setQuery('');
                        setStatus('all');
                    }}
                    className="mt-2 rounded-sm text-sm font-medium text-maroon-700 underline-offset-2 hover:underline"
                >
                    Clear search and filter
                </button>
            </div>
        );
    } else {
        body = (
            <>
                <div
                    className={`hidden border-b border-stone-200 bg-stone-50 px-6 py-2.5 text-xs font-semibold tracking-wide text-stone-500 uppercase ${grid}`}
                    aria-hidden="true"
                >
                    <span>Name</span>
                    <span>Status</span>
                    <span>{isLocation ? 'Events' : `Used by`}</span>
                    <span className="sr-only">Actions</span>
                </div>
                <ul className="divide-y divide-stone-100">
                    {shown.map((u) => {
                        const link = u.count > 0 ? peopleLink(u) : null;
                        const isFocused = isLocation && focused === u.key;
                        return (
                            <li
                                key={u.key}
                                className={`relative flex items-center gap-3 py-2 pr-2 pl-4 transition-colors md:min-h-14 md:py-1.5 md:pr-3 md:pl-6 ${grid} ${isFocused ? 'bg-maroon-50 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-maroon-700' : 'hover:bg-stone-50'}`}
                            >
                                <div className="min-w-0 flex-1 py-1">
                                    {isLocation ? (
                                        <button
                                            type="button"
                                            onClick={() => setFocused(u.key)}
                                            aria-pressed={isFocused}
                                            className="block max-w-full rounded-sm text-left"
                                            title="Show on the map"
                                        >
                                            <span
                                                className={`block font-medium break-words ${u.active ? 'text-stone-900' : 'text-stone-600'}`}
                                            >
                                                {u.name}
                                            </span>
                                            <span className="mt-0.5 block text-xs text-stone-500 tabular-nums">
                                                {u.latitude?.toFixed(5)}, {u.longitude?.toFixed(5)}
                                            </span>
                                        </button>
                                    ) : (
                                        <p
                                            className={`font-medium break-words ${u.active ? 'text-stone-900' : 'text-stone-600'}`}
                                        >
                                            {u.name}
                                        </p>
                                    )}
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 @xl:hidden">
                                        {!u.active && <StatusChip active={false} />}
                                        <span className="text-sm text-stone-500 tabular-nums">
                                            {u.count > 0 ? count(u.count, kind) : 'Not used yet'}
                                        </span>
                                    </div>
                                </div>
                                <div className="hidden @xl:block">
                                    <StatusChip active={u.active} />
                                </div>
                                <div className="hidden text-sm tabular-nums @xl:block">
                                    {link ? (
                                        <Link
                                            to={link}
                                            className="rounded-sm font-medium text-maroon-700 underline-offset-2 hover:underline"
                                        >
                                            {count(u.count, kind)}
                                        </Link>
                                    ) : (
                                        <span className="text-stone-500">
                                            {u.count > 0 ? count(u.count, kind) : 'Not used yet'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex shrink-0 justify-end">
                                    <button
                                        type="button"
                                        className={iconButton}
                                        aria-label={`Edit ${u.name}`}
                                        title="Edit"
                                        onClick={() => open(u)}
                                    >
                                        <EditIcon className="size-5" />
                                    </button>
                                    <button
                                        type="button"
                                        className={`${iconButton} hover:bg-red-50 hover:text-red-700`}
                                        aria-label={`Delete ${u.name}`}
                                        title="Delete"
                                        onClick={() => {
                                            remove.reset();
                                            save.reset();
                                            setRemoving(u);
                                        }}
                                    >
                                        <TrashIcon className="size-5" />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </>
        );
    }

    const table = (
        <>
            {list.isSuccess && units.length > 0 && (
                <div className="flex flex-col gap-3 border-b border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
                    <label className="relative block sm:w-72">
                        <span className="sr-only">Find a {c.one}</span>
                        <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-stone-500">
                            <SearchIcon className="size-4" />
                        </span>
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Find a ${c.one}`}
                            className="h-12 w-full rounded-control border border-stone-300 bg-white pr-3 pl-9 text-base text-stone-900 transition-colors placeholder:text-stone-500 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:h-10 md:text-sm"
                        />
                    </label>
                    <SegmentedControl<Status>
                        label="Show"
                        value={status}
                        onChange={setStatus}
                        options={[
                            { id: 'all', label: 'All', count: units.length },
                            { id: 'active', label: 'Active', count: activeCount },
                            {
                                id: 'inactive',
                                label: 'Inactive',
                                count: units.length - activeCount,
                            },
                        ]}
                    />
                </div>
            )}
            {body}
        </>
    );

    return (
        <section
            aria-labelledby={`${kind}-title`}
            className="@container overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
        >
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-stone-200 px-4 py-4 md:px-6 md:py-5">
                <div className="flex min-w-56 flex-1 items-start gap-3">
                    <span className="mt-0.5 hidden size-10 shrink-0 place-items-center rounded-control text-maroon-700 ring-1 ring-stone-200 sm:grid">
                        <ListIcon kind={kind} />
                    </span>
                    <div className="min-w-0">
                        <h2 id={`${kind}-title`} className="text-lg font-semibold text-stone-900">
                            {c.title}
                        </h2>
                        <p className="mt-0.5 max-w-xl text-sm text-pretty text-stone-600">
                            {c.about}
                        </p>
                    </div>
                </div>
                <Button
                    variant="primary"
                    size="md"
                    className="shrink-0 max-sm:min-h-12 max-sm:w-full max-sm:text-base"
                    onClick={() => open('new')}
                >
                    <PlusIcon className="size-5 sm:size-4" />
                    Add {c.one}
                </Button>
            </div>

            {isLocation && list.isSuccess && units.length > 0 && (
                <div className="border-b border-stone-200">
                    <LocationsOverview
                        places={units.map((u) => ({
                            key: u.key,
                            name: u.name,
                            active: u.active,
                            latitude: u.latitude ?? 0,
                            longitude: u.longitude ?? 0,
                        }))}
                        focused={focused}
                        onOpen={(key) => {
                            setFocused(key);
                            const unit = units.find((u) => u.key === key);
                            if (unit) open(unit);
                        }}
                    />
                </div>
            )}
            {table}

            <ConfirmDialog
                open={editing !== null}
                size={isLocation ? 'lg' : 'sm'}
                title={editing === 'new' ? `Add a ${c.one}` : `Edit ${c.one}`}
                description={
                    editing === 'new'
                        ? `It shows up in the ${c.one} choices on the forms and filters.`
                        : `A new name shows everywhere this ${c.one} is already used.`
                }
                confirmLabel={editing === 'new' ? `Add ${c.one}` : 'Save changes'}
                loadingLabel="Saving..."
                loading={save.isPending && editing !== null}
                confirmDisabled={name.trim() === '' || coordsMissing}
                error={
                    save.isError && !errors.name && editing !== null
                        ? errorMessage(save.error)
                        : null
                }
                onConfirm={() => submit()}
                onCancel={() => setEditing(null)}
            >
                <form onSubmit={submit} className="space-y-5">
                    <TextField
                        label="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={errors.name}
                        hint={c.example}
                        maxLength={100}
                        autoFocus
                    />
                    {isLocation && editing !== null && (
                        <LocationPicker
                            latitude={coords.latitude}
                            longitude={coords.longitude}
                            onChange={onCoords}
                            errors={{ latitude: errors.latitude, longitude: errors.longitude }}
                        />
                    )}
                    <label className="flex min-h-12 items-start gap-3 rounded-control py-1 text-stone-800">
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="mt-0.5 size-5 shrink-0 accent-maroon-700"
                        />
                        <span>
                            <span className="block text-sm font-medium">Active</span>
                            <span className="block text-sm text-stone-500">
                                Can be picked for new entries. Turn off to retire it without
                                changing existing ones.
                            </span>
                        </span>
                    </label>
                    {/* Enter in a field saves, like the dialog's main button. */}
                    <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
                </form>
            </ConfirmDialog>

            <ConfirmDialog
                open={removing !== null}
                title={removeDialog?.title ?? ''}
                description={removeDialog?.description ?? ''}
                confirmLabel={removeDialog?.confirm ?? 'Delete'}
                loadingLabel={removeDialog?.loading}
                tone={removeDialog?.tone ?? 'danger'}
                loading={remove.isPending || (save.isPending && removing !== null)}
                error={
                    removing !== null && (remove.isError || save.isError)
                        ? errorMessage(remove.error ?? save.error)
                        : null
                }
                onConfirm={() => removeDialog?.run()}
                onCancel={() => setRemoving(null)}
            />
        </section>
    );
}

export function ManageLists() {
    const permissions = useMe().data?.permissions ?? [];
    const canEvents = permissions.includes('events.manage');
    const [params, setParams] = useSearchParams();

    const lists: Record<ListKind, UseQueryResult<Unit[]>> = {
        teams: useList('teams'),
        departments: useList('departments'),
        'event-types': useList('event-types', canEvents),
        locations: useList('locations', canEvents),
    };
    const kinds: ListKind[] = canEvents
        ? ['teams', 'departments', 'event-types', 'locations']
        : ['teams', 'departments'];
    const asked = params.get('list') as ListKind | null;
    const kind: ListKind = asked && kinds.includes(asked) ? asked : 'teams';
    const choose = (next: ListKind) => setParams({ list: next }, { replace: true });

    const summary = (k: ListKind) => {
        const data = lists[k].data;
        if (!data) return null;
        const inactive = data.filter((u) => !u.active).length;
        return inactive > 0 ? `${data.length} total, ${inactive} inactive` : `${data.length} total`;
    };
    const groups = (['People', 'Events'] as const)
        .map((g) => ({ name: g, kinds: kinds.filter((k) => copy[k].group === g) }))
        .filter((g) => g.kinds.length > 0);

    return (
        <div className="mx-auto max-w-[1440px]">
            <header>
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    Manage lists
                </h1>
                <p className="mt-1 max-w-2xl text-pretty text-stone-600">
                    The choices people pick from across the system.{' '}
                    {canEvents
                        ? 'Teams and departments fill the person form. Event types and locations fill the event form.'
                        : 'Teams and departments fill the person form and the People filters.'}
                </p>
            </header>

            {/* Phones and tablets: one row of choices. */}
            <div className="mt-6 overflow-x-auto lg:hidden">
                <SegmentedControl<ListKind>
                    label="List"
                    value={kind}
                    onChange={choose}
                    options={kinds.map((k) => ({
                        id: k,
                        label: copy[k].title,
                        count: lists[k].data?.length,
                    }))}
                />
            </div>

            <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
                <nav aria-label="Lists" className="hidden lg:sticky lg:top-6 lg:block">
                    {groups.map((g, i) => (
                        <div key={g.name} className={i > 0 ? 'mt-6' : ''}>
                            <p className="px-3 text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                                {g.name}
                            </p>
                            <ul className="mt-2 space-y-1">
                                {g.kinds.map((k) => {
                                    const selected = k === kind;
                                    const line = summary(k);
                                    return (
                                        <li key={k}>
                                            <button
                                                type="button"
                                                onClick={() => choose(k)}
                                                aria-current={selected ? 'page' : undefined}
                                                className={`relative flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${selected ? 'bg-maroon-50 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-maroon-700' : 'hover:bg-stone-100'}`}
                                            >
                                                <span
                                                    className={
                                                        selected
                                                            ? 'text-maroon-700'
                                                            : 'text-stone-500'
                                                    }
                                                >
                                                    <ListIcon kind={k} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span
                                                        className={`block text-sm font-semibold ${selected ? 'text-maroon-800' : 'text-stone-900'}`}
                                                    >
                                                        {copy[k].title}
                                                    </span>
                                                    {line ? (
                                                        <span className="block text-xs text-stone-500 tabular-nums">
                                                            {line}
                                                        </span>
                                                    ) : (
                                                        <span className="mt-1 block h-3 w-20 animate-pulse rounded bg-stone-200" />
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                <ListPanel key={kind} kind={kind} list={lists[kind]} />
            </div>
        </div>
    );
}

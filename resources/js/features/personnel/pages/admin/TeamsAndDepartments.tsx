// A-Teams and departments. Admin adds, renames, deactivates and removes the values used by the
// people filters and the person form. A unit that still has people can be set inactive, not deleted.
// Desktop: two lists side by side. Phones: stacked. Add and edit open a small dialog.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
    deleteOrgUnit,
    errorMessage,
    fieldErrors,
    listDepartments,
    listTeams,
    saveOrgUnit,
    type OrgKind,
} from '@/features/personnel/people';
import {
    EditIcon,
    PeopleIcon,
    PlusIcon,
    TrashIcon,
    chipBase,
} from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';

interface Unit {
    key: string | number;
    name: string;
    active: boolean;
    people_count: number;
}

const copy: Record<
    OrgKind,
    { title: string; one: string; about: string; example: string; filter: string }
> = {
    teams: {
        title: 'Teams',
        one: 'team',
        about: 'The duty group a person works in.',
        example: 'For example, Traffic control.',
        filter: 'team',
    },
    departments: {
        title: 'Departments',
        one: 'department',
        about: 'The college or office a person belongs to.',
        example: 'For example, College of Nursing.',
        filter: 'department',
    },
};

const iconButton =
    'inline-flex size-12 items-center justify-center rounded-control text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200 md:size-10';

function count(n: number) {
    return n === 1 ? '1 person' : `${n} people`;
}

function SkeletonRows() {
    return (
        <ul aria-hidden="true" className="divide-y divide-stone-100">
            {[0, 1, 2, 3].map((row) => (
                <li key={row} className="flex items-center gap-4 px-4 py-4 md:px-6">
                    <div className="flex-1">
                        <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-stone-200" />
                    </div>
                    <div className="h-8 w-20 animate-pulse rounded bg-stone-200" />
                </li>
            ))}
        </ul>
    );
}

function Section({ kind }: { kind: OrgKind }) {
    const c = copy[kind];
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const list = useQuery({
        queryKey: [kind],
        queryFn: async (): Promise<Unit[]> =>
            kind === 'teams'
                ? (await listTeams()).map((t) => ({ ...t, key: t.code }))
                : (await listDepartments()).map((d) => ({ ...d, key: d.id })),
    });
    // editing: null = closed, 'new' = add dialog, else the unit being edited.
    const [editing, setEditing] = useState<Unit | 'new' | null>(null);
    const [name, setName] = useState('');
    const [active, setActive] = useState(true);
    const [removing, setRemoving] = useState<Unit | null>(null);

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: [kind] }),
            queryClient.invalidateQueries({ queryKey: ['people'] }),
        ]);
    const save = useMutation({
        mutationFn: (input: { key: string | number | null; name: string; active: boolean }) =>
            saveOrgUnit(kind, input.key, { name: input.name, active: input.active }),
        onSuccess: async () => {
            await refresh();
            setEditing(null);
            setRemoving(null);
        },
    });
    const remove = useMutation({
        mutationFn: (unit: Unit) => deleteOrgUnit(kind, unit.key),
        onSuccess: async () => {
            await refresh();
            setRemoving(null);
        },
    });

    function open(unit: Unit | 'new') {
        save.reset();
        setName(unit === 'new' ? '' : unit.name);
        setActive(unit === 'new' ? true : unit.active);
        setEditing(unit);
    }

    function submit(e?: FormEvent) {
        e?.preventDefault();
        if (name.trim() === '' || save.isPending) return;
        save.mutate({
            key: editing === 'new' || editing === null ? null : editing.key,
            name: name.trim(),
            active,
        });
    }

    const nameError = fieldErrors(save.error).name;
    const units = list.data ?? [];
    const inactive = units.filter((u) => !u.active).length;
    const peopleLink = (u: Unit) => `/admin/people?${c.filter}=${encodeURIComponent(u.key)}`;

    // A unit with people cannot be deleted. The dialog says why and offers the next best step.
    const inUse = removing !== null && removing.people_count > 0;
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
            description: `No one is in this ${c.one}. Deleting it removes it from every list. You cannot undo this.`,
            confirm: 'Delete',
            loading: 'Deleting...',
            tone: 'danger',
            run: () => remove.mutate(removing),
        };
    } else if (removing && removing.active) {
        removeDialog = {
            title: `${removing.name} still has people`,
            description: `${count(removing.people_count)} ${removing.people_count === 1 ? 'is' : 'are'} in this ${c.one}, so it cannot be deleted. Set it inactive to hide it from the choices for new people. The people keep it.`,
            confirm: 'Set inactive',
            loading: 'Saving...',
            tone: 'primary',
            run: () => save.mutate({ key: removing.key, name: removing.name, active: false }),
        };
    } else if (removing) {
        removeDialog = {
            title: `${removing.name} still has people`,
            description: `${count(removing.people_count)} ${removing.people_count === 1 ? 'is' : 'are'} in this ${c.one}, so it cannot be deleted yet. Move them to another ${c.one} first.`,
            confirm: 'View people',
            loading: 'Opening...',
            tone: 'primary',
            run: () => navigate(peopleLink(removing)),
        };
    }

    let body: ReactNode;
    if (list.isPending) {
        body = <SkeletonRows />;
    } else if (list.isError) {
        body = (
            <div className="space-y-3 px-4 py-5 md:px-6">
                <Alert tone="error">
                    The list did not load. Check your connection and try again.
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
            <div className="flex flex-col items-center px-6 py-12 text-center">
                <PeopleIcon className="size-6 text-stone-400" />
                <p className="mt-3 text-stone-700">No {c.title.toLowerCase()} yet.</p>
                <p className="mt-1 text-sm text-stone-500">
                    Add the first one to use it on people.
                </p>
            </div>
        );
    } else {
        body = (
            <ul className="divide-y divide-stone-100">
                {units.map((u) => (
                    <li
                        key={u.key}
                        className="flex items-center gap-3 py-2 pr-2 pl-4 md:min-h-16 md:pr-3 md:pl-6"
                    >
                        <div className="min-w-0 flex-1 py-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p
                                    className={`font-medium break-words ${u.active ? 'text-stone-900' : 'text-stone-600'}`}
                                >
                                    {u.name}
                                </p>
                                {!u.active && (
                                    <span
                                        className={`${chipBase} bg-stone-100 text-stone-600 ring-stone-200`}
                                    >
                                        Inactive
                                    </span>
                                )}
                            </div>
                            {u.people_count > 0 ? (
                                <Link
                                    to={peopleLink(u)}
                                    className="mt-0.5 inline-flex rounded-sm text-sm font-medium text-maroon-700 tabular-nums underline-offset-2 hover:underline"
                                >
                                    {count(u.people_count)}
                                </Link>
                            ) : (
                                <p className="mt-0.5 text-sm text-stone-500">No one yet</p>
                            )}
                        </div>
                        <div className="flex shrink-0">
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
                                className={`${iconButton} hover:text-red-700`}
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
                ))}
            </ul>
        );
    }

    return (
        <section
            aria-labelledby={`${kind}-title`}
            className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
        >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-stone-200 px-4 py-4 md:px-6 md:py-5">
                <div className="min-w-48 flex-1">
                    <h2 id={`${kind}-title`} className="text-lg font-semibold text-stone-900">
                        {c.title}
                        {list.isSuccess && (
                            <span className="ml-2 text-base font-normal text-stone-500 tabular-nums">
                                {units.length}
                            </span>
                        )}
                    </h2>
                    <p className="mt-0.5 text-sm text-pretty text-stone-600">
                        {c.about}
                        {inactive > 0 && ` ${inactive} inactive.`}
                    </p>
                </div>
                <Button
                    variant="secondary"
                    size="md"
                    className="shrink-0 max-sm:min-h-12 max-sm:w-full max-sm:text-base"
                    onClick={() => open('new')}
                >
                    <PlusIcon className="size-5 sm:size-4" />
                    Add {c.one}
                </Button>
            </div>

            {body}

            <ConfirmDialog
                open={editing !== null}
                title={editing === 'new' ? `Add a ${c.one}` : `Edit ${c.one}`}
                description={
                    editing === 'new'
                        ? `It shows up in the ${c.one} choices on the person form and the people filters.`
                        : `A new name shows on everyone already in this ${c.one}.`
                }
                confirmLabel={editing === 'new' ? `Add ${c.one}` : 'Save changes'}
                loadingLabel="Saving..."
                loading={save.isPending && editing !== null}
                confirmDisabled={name.trim() === ''}
                error={
                    save.isError && !nameError && editing !== null ? errorMessage(save.error) : null
                }
                onConfirm={() => submit()}
                onCancel={() => setEditing(null)}
            >
                <form onSubmit={submit} className="space-y-4">
                    <TextField
                        label="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={nameError}
                        hint={c.example}
                        maxLength={100}
                        autoFocus
                    />
                    <label className="flex min-h-12 items-start gap-3 py-1 text-stone-800">
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="mt-0.5 size-5 shrink-0 accent-maroon-700"
                        />
                        <span>
                            <span className="block text-sm font-medium">Active</span>
                            <span className="block text-sm text-stone-500">
                                Can be picked for new people. Turn off to retire it without changing
                                anyone.
                            </span>
                        </span>
                    </label>
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

export function TeamsAndDepartments() {
    return (
        <div className="mx-auto max-w-[1440px]">
            <header>
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    Teams and departments
                </h1>
                <p className="mt-1 max-w-2xl text-pretty text-stone-600">
                    Every person can have one team and one department. These lists fill those
                    choices on the person form and the People filters.
                </p>
            </header>
            <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
                <Section kind="teams" />
                <Section kind="departments" />
            </div>
        </div>
    );
}

// A-Teams and departments. Admin adds, renames, deactivates and removes the values used by the
// people filters and the person form. A unit that still has people can be deactivated, not deleted.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import {
    deleteOrgUnit,
    errorMessage,
    fieldErrors,
    listDepartments,
    listTeams,
    saveOrgUnit,
    type OrgKind,
} from '@/features/personnel/people';
import { BackLink } from '@/features/personnel/components/ui';
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

const copy: Record<OrgKind, { title: string; one: string; hint: string }> = {
    teams: { title: 'Teams', one: 'team', hint: 'For example Traffic control.' },
    departments: {
        title: 'Departments',
        one: 'department',
        hint: 'For example College of Nursing.',
    },
};

function Section({ kind }: { kind: OrgKind }) {
    const c = copy[kind];
    const queryClient = useQueryClient();
    const list = useQuery({
        queryKey: [kind],
        queryFn: async (): Promise<Unit[]> =>
            kind === 'teams'
                ? (await listTeams()).map((t) => ({ ...t, key: t.code }))
                : (await listDepartments()).map((d) => ({ ...d, key: d.id })),
    });
    // editing: null = closed, 'new' = add form, else the unit being edited.
    const [editing, setEditing] = useState<Unit | 'new' | null>(null);
    const [name, setName] = useState('');
    const [active, setActive] = useState(true);
    const [removing, setRemoving] = useState<Unit | null>(null);

    const refresh = () => queryClient.invalidateQueries({ queryKey: [kind] });
    const save = useMutation({
        mutationFn: () =>
            saveOrgUnit(kind, editing === 'new' || editing === null ? null : editing.key, {
                name,
                active,
            }),
        onSuccess: async () => {
            await refresh();
            setEditing(null);
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

    function submit(e: FormEvent) {
        e.preventDefault();
        save.mutate();
    }

    const nameError = fieldErrors(save.error).name;

    return (
        <section
            aria-labelledby={`${kind}-title`}
            className="rounded-card bg-white ring-1 ring-stone-200"
        >
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 md:px-5">
                <h2 id={`${kind}-title`} className="text-lg font-semibold text-stone-900">
                    {c.title}
                </h2>
                {editing === null && (
                    <Button size="md" onClick={() => open('new')}>
                        Add {c.one}
                    </Button>
                )}
            </div>

            {editing !== null && (
                <form
                    onSubmit={submit}
                    className="space-y-4 border-b border-stone-200 bg-stone-50 px-4 py-4 md:px-5"
                >
                    <TextField
                        label={`${editing === 'new' ? 'New' : 'Edit'} ${c.one} name`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={nameError}
                        hint={c.hint}
                        maxLength={100}
                        autoFocus
                    />
                    <label className="flex min-h-12 items-center gap-3 text-base text-stone-800 md:min-h-10 md:text-sm">
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="size-5 accent-maroon-700 md:size-4"
                        />
                        Active (can be picked for new people)
                    </label>
                    {save.isError && !nameError && (
                        <Alert tone="error">{errorMessage(save.error)}</Alert>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
                        <Button type="submit" loading={save.isPending} className="w-full sm:w-auto">
                            Save
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditing(null)}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            )}

            {list.isError && (
                <div className="p-4">
                    <Alert tone="error">
                        The list did not load. Check your connection and try again.
                    </Alert>
                </div>
            )}
            {list.isPending && <p className="px-5 py-6 text-stone-500">Loading...</p>}
            {list.isSuccess && list.data.length === 0 && (
                <p className="px-5 py-8 text-center text-stone-600">
                    No {c.title.toLowerCase()} yet.
                </p>
            )}
            <ul className="divide-y divide-stone-100">
                {list.data?.map((u) => (
                    <li
                        key={u.key}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-5"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-stone-900">{u.name}</p>
                            <p className="text-sm text-stone-600">
                                {u.people_count === 1 ? '1 person' : `${u.people_count} people`}
                                {!u.active && ' · Inactive'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="md" onClick={() => open(u)}>
                                Edit
                            </Button>
                            <Button
                                variant="secondary"
                                size="md"
                                disabled={u.people_count > 0}
                                title={
                                    u.people_count > 0
                                        ? 'Still has people. Deactivate it instead.'
                                        : undefined
                                }
                                onClick={() => {
                                    remove.reset();
                                    setRemoving(u);
                                }}
                            >
                                Delete
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>

            <ConfirmDialog
                open={removing !== null}
                title={`Delete ${removing?.name ?? c.one}?`}
                description={`This removes the ${c.one} from the list. It cannot be undone.`}
                confirmLabel="Delete"
                loadingLabel="Deleting..."
                tone="danger"
                loading={remove.isPending}
                error={remove.isError ? errorMessage(remove.error) : null}
                onConfirm={() => removing && remove.mutate(removing)}
                onCancel={() => setRemoving(null)}
            />
        </section>
    );
}

export function TeamsAndDepartments() {
    return (
        <div className="mx-auto max-w-[1440px]">
            <BackLink to="/admin/people">People</BackLink>
            <header className="mt-4">
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    Teams and departments
                </h1>
                <p className="mt-1 max-w-xl text-pretty text-stone-600">
                    These fill the Team and Department choices when you add a person or filter the
                    list.
                </p>
            </header>
            <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
                <Section kind="teams" />
                <Section kind="departments" />
            </div>
        </div>
    );
}

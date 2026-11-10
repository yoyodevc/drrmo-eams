// A-Role. One role: its permissions as switches grouped by module, and the people who hold it.
// Changes collect in a save bar, so an admin can flip several switches and save once.
// Locked switches show why they cannot change. Every save goes in the audit log.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import {
    addRoleMembers,
    deleteRole,
    getRole,
    listPermissions,
    saveRolePermissions,
    updateRole,
    type PermissionDef,
    type Role,
} from '@/features/access/api';
import {
    grouped,
    RoleTypeChip,
    SaveBar,
    Switch,
    withChanges,
} from '@/features/access/components/ui';
import {
    Avatar,
    BackLink,
    EditIcon,
    LockIcon,
    PeopleIcon,
    PlusIcon,
    SearchIcon,
    TrashIcon,
    chipBase,
    day,
} from '@/features/personnel/components/ui';
import { errorMessage, fieldErrors, listPeople, type Person } from '@/features/personnel/people';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';

type Tab = 'permissions' | 'people';

const headCell =
    'px-5 py-3 whitespace-nowrap text-xs font-semibold tracking-wide text-stone-500 uppercase';

function PermissionRow({
    def,
    role,
    on,
    changed,
    onChange,
}: {
    def: PermissionDef;
    role: Role;
    on: boolean;
    changed: boolean;
    onChange: (on: boolean) => void;
}) {
    const id = useId();
    const lock = role.locks[def.code];

    return (
        <li
            className={`flex items-start gap-4 px-4 py-3.5 transition-colors md:px-6 ${changed ? 'bg-amber-50/60' : ''}`}
        >
            <div className="pt-0.5">
                <Switch
                    on={on}
                    locked={lock !== undefined}
                    label={def.label}
                    describedBy={`${id}-desc`}
                    onChange={onChange}
                />
            </div>
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-stone-900">
                    {def.label}
                    {changed && (
                        <span className={`${chipBase} bg-amber-50 text-amber-900 ring-amber-200`}>
                            {on ? 'Will be added' : 'Will be removed'}
                        </span>
                    )}
                </p>
                <p id={`${id}-desc`} className="text-sm text-pretty text-stone-600">
                    {def.description}.
                    {lock && <span className="sr-only"> Locked. {lock.reason}</span>}
                </p>
                {lock && (
                    <p
                        aria-hidden="true"
                        className="mt-1 flex items-start gap-1.5 text-sm text-stone-500"
                    >
                        <LockIcon className="mt-0.5 size-4 shrink-0" />
                        {lock.reason}
                    </p>
                )}
            </div>
            <code className="hidden shrink-0 pt-0.5 font-mono text-xs text-stone-400 lg:block">
                {def.code}
            </code>
        </li>
    );
}

function PermissionsTab({ role }: { role: Role }) {
    const queryClient = useQueryClient();
    const catalog = useQuery({ queryKey: ['permissions'], queryFn: listPermissions });
    const [pending, setPending] = useState<Record<string, boolean>>({});

    const save = useMutation({
        mutationFn: () =>
            saveRolePermissions([{ id: role.id, permissions: withChanges(role, pending) }]),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['roles'] });
            await queryClient.invalidateQueries({ queryKey: ['role', role.id] });
            await queryClient.invalidateQueries({ queryKey: ['me'] });
            setPending({});
        },
    });

    const holds = (code: string) => pending[code] ?? role.permissions.includes(code);
    const toggle = (code: string, on: boolean) => {
        save.reset();
        setPending((current) => {
            const next = { ...current };
            if (on === role.permissions.includes(code)) delete next[code];
            else next[code] = on;
            return next;
        });
    };

    if (catalog.isPending) {
        return (
            <div aria-hidden="true" className="space-y-4">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-40 animate-pulse rounded-card bg-stone-200" />
                ))}
            </div>
        );
    }
    if (catalog.isError) {
        return (
            <div className="max-w-xl space-y-3">
                <Alert tone="error">The permissions did not load.</Alert>
                <Button variant="secondary" size="md" onClick={() => void catalog.refetch()}>
                    Retry
                </Button>
            </div>
        );
    }

    const all = catalog.data.data;
    const held = all.filter((p) => holds(p.code)).length;
    const changes = Object.keys(pending).length;

    return (
        <>
            <p className="text-sm text-stone-600">
                {role.name} holds{' '}
                <span className="font-semibold text-stone-900 tabular-nums">{held}</span> of{' '}
                <span className="tabular-nums">{all.length}</span> permissions.
            </p>

            <div className="mt-4 space-y-4">
                {grouped(all, catalog.data.groups).map(({ group, items }) => {
                    const editable = items.filter((p) => role.locks[p.code] === undefined);
                    const allOn = editable.length > 0 && editable.every((p) => holds(p.code));
                    const on = items.filter((p) => holds(p.code)).length;
                    return (
                        <section
                            key={group.key}
                            aria-labelledby={`group-${group.key}`}
                            className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
                        >
                            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 md:px-6">
                                <h2
                                    id={`group-${group.key}`}
                                    className="font-semibold text-stone-900"
                                >
                                    {group.label}
                                    <span className="ml-2 text-sm font-normal text-stone-500 tabular-nums">
                                        {on} of {items.length}
                                    </span>
                                </h2>
                                {editable.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            editable.forEach((p) => toggle(p.code, !allOn))
                                        }
                                        className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-semibold text-maroon-700 transition-colors hover:bg-maroon-50"
                                    >
                                        {allOn ? 'Turn all off' : 'Turn all on'}
                                    </button>
                                )}
                            </div>
                            <ul className="divide-y divide-stone-100">
                                {items.map((p) => (
                                    <PermissionRow
                                        key={p.code}
                                        def={p}
                                        role={role}
                                        on={holds(p.code)}
                                        changed={pending[p.code] !== undefined}
                                        onChange={(value) => toggle(p.code, value)}
                                    />
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>

            <SaveBar
                changes={changes}
                saving={save.isPending}
                error={save.isError ? errorMessage(save.error) : null}
                onSave={() => save.mutate()}
                onDiscard={() => {
                    save.reset();
                    setPending({});
                }}
            />
        </>
    );
}

function AddPeopleDialog({
    open,
    role,
    onClose,
}: {
    open: boolean;
    role: Role;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState<Map<number, Person>>(new Map());

    const people = useQuery({
        queryKey: ['people', 'role-picker', search],
        queryFn: () =>
            listPeople({ search, role: '', team: '', status: '', department: '', page: 1 }),
        enabled: open,
        placeholderData: keepPreviousData,
    });
    const candidates = (people.data?.data ?? []).filter((p) => p.role !== role.code);

    const save = useMutation({
        mutationFn: () => addRoleMembers(role.id, [...picked.keys()]),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['roles'] });
            await queryClient.invalidateQueries({ queryKey: ['role', role.id] });
            await queryClient.invalidateQueries({ queryKey: ['people'] });
            onClose();
        },
    });
    const errors = fieldErrors(save.error);
    const problem = errors.user_ids ?? (save.isError ? errorMessage(save.error) : null);

    const flip = (person: Person) => {
        save.reset();
        setPicked((current) => {
            const next = new Map(current);
            if (next.has(person.id)) next.delete(person.id);
            else next.set(person.id, person);
            return next;
        });
    };

    return (
        <ConfirmDialog
            open={open}
            title={`Add people to ${role.name}`}
            description="Each person has one role, so they leave their current role. Their screens change the next time the app loads."
            confirmLabel={
                picked.size === 0
                    ? 'Move people'
                    : `Move ${picked.size} ${picked.size === 1 ? 'person' : 'people'}`
            }
            loadingLabel="Moving..."
            loading={save.isPending}
            confirmDisabled={picked.size === 0}
            error={problem}
            onConfirm={() => save.mutate()}
            onCancel={onClose}
        >
            <div className="space-y-3">
                <label className="block text-sm font-medium text-stone-800">
                    <span className="mb-1.5 block">Find people</span>
                    <span className="relative block">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-500" />
                        <input
                            type="search"
                            value={search}
                            placeholder="Name or email"
                            onChange={(e) => setSearch(e.target.value)}
                            className="block min-h-12 w-full rounded-control border border-stone-300 bg-white pr-3 pl-10 text-base text-stone-900 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none"
                        />
                    </span>
                </label>
                <ul
                    aria-label="People"
                    aria-busy={people.isFetching || undefined}
                    className="h-64 divide-y divide-stone-100 overflow-y-auto rounded-control ring-1 ring-stone-200"
                >
                    {people.isPending && (
                        <li className="px-3 py-3 text-sm text-stone-500">Loading...</li>
                    )}
                    {people.data && candidates.length === 0 && (
                        <li className="px-3 py-3 text-sm text-stone-500">Nobody else matches.</li>
                    )}
                    {candidates.map((p) => (
                        <li key={p.id}>
                            <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-stone-50">
                                <input
                                    type="checkbox"
                                    checked={picked.has(p.id)}
                                    onChange={() => flip(p)}
                                    className="size-5 shrink-0 cursor-pointer rounded accent-maroon-700"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-stone-900">
                                        {p.name}
                                    </span>
                                    <span className="block truncate text-sm text-stone-500">
                                        Now {p.role_name ?? 'no role'}
                                        {p.team_name ? `, ${p.team_name}` : ''}
                                    </span>
                                </span>
                            </label>
                        </li>
                    ))}
                </ul>
                <p className="min-h-5 text-sm text-stone-600" aria-live="polite">
                    {picked.size > 0 &&
                        `Selected: ${[...picked.values()].map((p) => p.first_name).join(', ')}`}
                </p>
            </div>
        </ConfirmDialog>
    );
}

function PeopleTab({ role }: { role: Role }) {
    const [page, setPage] = useState(1);
    const [adding, setAdding] = useState(false);
    const people = useQuery({
        queryKey: ['people', 'role', role.code, page],
        queryFn: () =>
            listPeople({ search: '', role: role.code, team: '', status: '', department: '', page }),
        placeholderData: keepPreviousData,
    });

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-pretty text-stone-600">
                    To take someone out of {role.name}, add them to another role.
                </p>
                <Button variant="secondary" size="md" onClick={() => setAdding(true)}>
                    <PlusIcon className="size-4" />
                    Add people
                </Button>
            </div>

            <div className="mt-4 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                {people.isPending ? (
                    <div aria-hidden="true" className="divide-y divide-stone-100">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                                <div className="size-10 animate-pulse rounded-full bg-stone-200" />
                                <div className="h-4 w-48 animate-pulse rounded bg-stone-200" />
                            </div>
                        ))}
                    </div>
                ) : people.isError ? (
                    <div className="space-y-3 p-5">
                        <Alert tone="error">The people in this role did not load.</Alert>
                        <Button variant="secondary" size="md" onClick={() => void people.refetch()}>
                            Retry
                        </Button>
                    </div>
                ) : people.data.data.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-12 text-center">
                        <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                            <PeopleIcon className="size-6" />
                        </span>
                        <p className="mt-4 font-semibold text-stone-900">
                            Nobody has this role yet
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-pretty text-stone-600">
                            Use Add people to move people into {role.name}.
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="border-b border-stone-200">
                            <tr>
                                <th className={headCell}>Person</th>
                                <th className={`${headCell} hidden md:table-cell`}>Team</th>
                                <th className={`${headCell} hidden lg:table-cell`}>Last sign in</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {people.data.data.map((p) => (
                                <tr
                                    key={p.id}
                                    className="relative transition-colors hover:bg-stone-50"
                                >
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar first={p.first_name} last={p.last_name} />
                                            <div className="min-w-0">
                                                <Link
                                                    to={`/admin/people/${p.id}`}
                                                    className="font-medium text-stone-900 after:absolute after:inset-0 hover:text-maroon-700"
                                                >
                                                    {p.name}
                                                </Link>
                                                <p className="truncate text-sm text-stone-500">
                                                    {p.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="hidden px-5 py-3 text-sm text-stone-700 md:table-cell">
                                        {p.team_name ?? (
                                            <span className="text-stone-500">No team</span>
                                        )}
                                    </td>
                                    <td className="hidden px-5 py-3 text-sm text-stone-700 tabular-nums lg:table-cell">
                                        {day(p.last_login_at) ?? (
                                            <span className="text-stone-500">Never</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {people.data && people.data.meta.last_page > 1 && (
                <nav
                    aria-label="Pages"
                    className="mt-4 flex items-center justify-between gap-3 text-sm text-stone-600"
                >
                    <span className="tabular-nums">
                        Page {people.data.meta.page} of {people.data.meta.last_page}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="md"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="secondary"
                            size="md"
                            disabled={page >= people.data.meta.last_page}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </nav>
            )}

            <AddPeopleDialog
                key={adding ? 'open' : 'closed'}
                open={adding}
                role={role}
                onClose={() => setAdding(false)}
            />
        </>
    );
}

function EditDialog({ open, role, onClose }: { open: boolean; role: Role; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState(role.name);
    const [description, setDescription] = useState(role.description ?? '');
    const save = useMutation({
        mutationFn: () => updateRole(role.id, { name, description }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['roles'] });
            await queryClient.invalidateQueries({ queryKey: ['role', role.id] });
            await queryClient.invalidateQueries({ queryKey: ['role-options'] });
            onClose();
        },
    });
    const errors = fieldErrors(save.error);
    const general = save.isError && Object.keys(errors).length === 0;

    return (
        <ConfirmDialog
            open={open}
            title="Edit role details"
            description="The new name shows everywhere at once. Permissions and people stay the same."
            confirmLabel="Save details"
            loadingLabel="Saving..."
            loading={save.isPending}
            confirmDisabled={name.trim().length < 3}
            error={general ? errorMessage(save.error) : null}
            onConfirm={() => save.mutate()}
            onCancel={onClose}
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim().length >= 3 && !save.isPending) save.mutate();
                }}
            >
                <TextField
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                    maxLength={50}
                    required
                />
                <TextField
                    label="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    error={errors.description}
                    maxLength={255}
                />
            </form>
        </ConfirmDialog>
    );
}

export function RoleDetail() {
    const { id } = useParams();
    const roleId = Number(id);
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [params, setParams] = useSearchParams();
    const tab: Tab = params.get('tab') === 'people' ? 'people' : 'permissions';
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const created = (location.state as { created?: boolean } | null)?.created === true;

    const role = useQuery({ queryKey: ['role', roleId], queryFn: () => getRole(roleId) });
    const remove = useMutation({
        mutationFn: () => deleteRole(roleId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['roles'] });
            await queryClient.invalidateQueries({ queryKey: ['role-options'] });
            void navigate('/admin/access/roles', { replace: true });
        },
    });

    const r = role.data;
    const tabs: { value: Tab; label: string; count?: number }[] = [
        { value: 'permissions', label: 'Permissions' },
        { value: 'people', label: 'People', count: r?.members_count },
    ];

    return (
        <div className="mx-auto max-w-5xl">
            <BackLink to="/admin/access/roles">Roles</BackLink>

            {role.isError ? (
                <div className="mt-6 max-w-xl space-y-3">
                    <Alert tone="error">This role did not load. It may have been deleted.</Alert>
                    <Button variant="secondary" size="md" onClick={() => void role.refetch()}>
                        Retry
                    </Button>
                </div>
            ) : (
                <>
                    <header className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                        <div className="min-w-0">
                            <div
                                className="brand-stripe h-1 w-12 rounded-full"
                                aria-hidden="true"
                            />
                            {r ? (
                                <>
                                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                                        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                                            {r.name}
                                        </h1>
                                        <RoleTypeChip role={r} />
                                        {r.is_field && (
                                            <span
                                                className={`${chipBase} bg-sky-50 text-sky-800 ring-sky-200`}
                                            >
                                                Goes on duty
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 max-w-2xl text-pretty text-stone-600">
                                        {r.description ?? 'No description yet.'}
                                    </p>
                                </>
                            ) : (
                                <div aria-hidden="true" className="mt-4 space-y-2">
                                    <div className="h-8 w-56 animate-pulse rounded bg-stone-200" />
                                    <div className="h-4 w-80 animate-pulse rounded bg-stone-200" />
                                </div>
                            )}
                        </div>
                        {r && !r.is_system && (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={() => setEditing(true)}
                                >
                                    <EditIcon className="size-4" />
                                    Edit details
                                </Button>
                                <button
                                    type="button"
                                    className="inline-flex min-h-10 items-center gap-2 rounded-control px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 active:bg-red-100"
                                    onClick={() => {
                                        remove.reset();
                                        setDeleting(true);
                                    }}
                                >
                                    <TrashIcon className="size-4" />
                                    Delete
                                </button>
                            </div>
                        )}
                    </header>

                    {created && r && (
                        <div className="mt-6">
                            <Alert tone="success">
                                {r.name} is ready. Turn on what it may do, then add people.
                            </Alert>
                        </div>
                    )}
                    {r?.is_admin && (
                        <div className="mt-6">
                            <Alert tone="info">
                                Admin always has every permission, so nothing here can change. To
                                give someone part of the admin side, make a custom role or use
                                Temporary access.
                            </Alert>
                        </div>
                    )}

                    <div
                        role="tablist"
                        aria-label="Role sections"
                        className="mt-6 flex gap-6 border-b border-stone-200"
                    >
                        {tabs.map((t) => (
                            <button
                                key={t.value}
                                role="tab"
                                type="button"
                                id={`tab-${t.value}`}
                                aria-selected={tab === t.value}
                                aria-controls={`panel-${t.value}`}
                                onClick={() =>
                                    setParams(t.value === 'people' ? { tab: 'people' } : {}, {
                                        replace: true,
                                        state: location.state,
                                    })
                                }
                                className={`-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 text-sm font-semibold transition-colors ${tab === t.value ? 'border-maroon-700 text-maroon-800' : 'border-transparent text-stone-600 hover:text-stone-900'}`}
                            >
                                {t.label}
                                {t.count !== undefined && (
                                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 tabular-nums">
                                        {t.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div
                        role="tabpanel"
                        id={`panel-${tab}`}
                        aria-labelledby={`tab-${tab}`}
                        className="mt-6"
                    >
                        {!r ? (
                            <div
                                aria-hidden="true"
                                className="h-64 animate-pulse rounded-card bg-stone-200"
                            />
                        ) : tab === 'permissions' ? (
                            <PermissionsTab key={r.id} role={r} />
                        ) : (
                            <PeopleTab key={r.id} role={r} />
                        )}
                    </div>
                </>
            )}

            {r && !r.is_system && (
                <>
                    <EditDialog
                        key={editing ? 'open' : 'closed'}
                        open={editing}
                        role={r}
                        onClose={() => setEditing(false)}
                    />
                    <ConfirmDialog
                        open={deleting}
                        tone="danger"
                        title={`Delete ${r.name}?`}
                        description={
                            r.members_count > 0
                                ? `${r.members_count} ${r.members_count === 1 ? 'person still has' : 'people still have'} this role. Move them to another role first, on the People tab.`
                                : 'The role and its permissions go away. The audit log keeps a record.'
                        }
                        confirmLabel="Delete role"
                        loadingLabel="Deleting..."
                        loading={remove.isPending}
                        confirmDisabled={r.members_count > 0}
                        error={remove.isError ? errorMessage(remove.error) : null}
                        onConfirm={() => remove.mutate()}
                        onCancel={() => setDeleting(false)}
                    />
                </>
            )}
        </div>
    );
}

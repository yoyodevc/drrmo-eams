// A-Roles. Every role, how many people hold it and how much of the admin side it opens.
// Desktop first at 1280 px: a table where the whole row opens the role. Under 768 px the rows
// become a tappable list. New role starts from a copy of another role or from the basics.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { createRole, listPermissions, listRoles, type Role } from '@/features/access/api';
import { GridIcon, PageHeader, RoleTypeChip, ShieldIcon } from '@/features/access/components/ui';
import { ChevronDownIcon, ChevronIcon, PlusIcon } from '@/features/personnel/components/ui';
import { errorMessage, fieldErrors } from '@/features/personnel/people';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';

const headCell =
    'px-5 py-3 whitespace-nowrap text-xs font-semibold tracking-wide text-stone-500 uppercase';

const selectClass =
    'block min-h-12 w-full cursor-pointer appearance-none rounded-control border border-stone-300 bg-white pr-11 pl-3.5 text-base text-stone-900 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none';

// How much of the admin side a role opens, as a short bar and a count.
function Reach({ held, total }: { held: number; total: number }) {
    const share = total === 0 ? 0 : held / total;
    return (
        <div className="flex items-center gap-3">
            <span
                aria-hidden="true"
                className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-stone-200"
            >
                <span
                    className="absolute inset-y-0 left-0 rounded-full bg-maroon-700"
                    style={{ width: `${Math.round(share * 100)}%` }}
                />
            </span>
            <span className="text-sm whitespace-nowrap text-stone-700 tabular-nums">
                {held === 0 ? 'None' : held === total ? 'All' : `${held} of ${total}`}
            </span>
        </div>
    );
}

function SkeletonRows() {
    return (
        <div aria-hidden="true" className="divide-y divide-stone-100">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-6 px-5 py-4">
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                        <div className="h-3 w-64 animate-pulse rounded bg-stone-200" />
                    </div>
                    <div className="hidden h-4 w-16 animate-pulse rounded bg-stone-200 md:block" />
                    <div className="hidden h-4 w-32 animate-pulse rounded bg-stone-200 md:block" />
                </div>
            ))}
        </div>
    );
}

function NewRoleDialog({
    open,
    roles,
    onClose,
}: {
    open: boolean;
    roles: Role[];
    onClose: () => void;
}) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [copyFrom, setCopyFrom] = useState('');

    const save = useMutation({
        mutationFn: () =>
            createRole({ name, description, copy_from: copyFrom ? Number(copyFrom) : null }),
        onSuccess: async (role) => {
            await queryClient.invalidateQueries({ queryKey: ['roles'] });
            await queryClient.invalidateQueries({ queryKey: ['role-options'] });
            void navigate(`/admin/access/roles/${role.id}`, { state: { created: true } });
        },
    });
    const errors = fieldErrors(save.error);
    const general = save.isError && Object.keys(errors).length === 0;
    const ready = name.trim().length >= 3;

    return (
        <ConfirmDialog
            open={open}
            title="New role"
            description="Name the job, then choose what it starts with. You pick the permissions on the next screen."
            confirmLabel="Create role"
            loadingLabel="Creating..."
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
                <TextField
                    label="Name"
                    placeholder="For example, Records officer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                    maxLength={50}
                    required
                />
                <TextField
                    label="Description (optional)"
                    placeholder="Who gets this role and why"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    error={errors.description}
                    maxLength={255}
                />
                <label className="block text-sm font-medium text-stone-800">
                    <span className="mb-1.5 block">Start with</span>
                    <span className="relative block">
                        <select
                            className={selectClass}
                            value={copyFrom}
                            onChange={(e) => setCopyFrom(e.target.value)}
                        >
                            <option value="">The basics only</option>
                            {roles
                                .filter((r) => !r.is_admin)
                                .map((r) => (
                                    <option key={r.id} value={r.id}>
                                        A copy of {r.name}
                                    </option>
                                ))}
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-stone-500" />
                    </span>
                    <span className="mt-1.5 block font-normal text-stone-500">
                        The basics are reading memos, messages and your own profile. Duty stays with
                        Marshal and Volunteer.
                    </span>
                </label>
            </form>
        </ConfirmDialog>
    );
}

export function RolesList() {
    const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
    const catalog = useQuery({ queryKey: ['permissions'], queryFn: listPermissions });
    const [adding, setAdding] = useState(false);

    const adminCodes = new Set(
        (catalog.data?.data ?? []).filter((p) => p.admin).map((p) => p.code),
    );
    const reach = (role: Role) => role.permissions.filter((c) => adminCodes.has(c)).length;
    const people = (roles.data ?? []).reduce((sum, r) => sum + r.members_count, 0);

    return (
        <div className="mx-auto max-w-[1440px]">
            <PageHeader
                title="Roles"
                actions={
                    <>
                        <Link
                            to="/admin/access/matrix"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-4 text-base font-semibold text-stone-800 transition-colors hover:bg-stone-50 md:min-h-10 md:text-sm"
                        >
                            <GridIcon className="size-5 text-stone-500 md:size-4" />
                            Permission matrix
                        </Link>
                        <Button
                            variant="primary"
                            size="md"
                            className="max-md:min-h-12 max-md:flex-1 max-md:text-base"
                            onClick={() => setAdding(true)}
                            disabled={!roles.data}
                        >
                            <PlusIcon className="size-4" />
                            New role
                        </Button>
                    </>
                }
            >
                Everyone has one role. A role is a set of permissions, and it decides which screens
                a person sees. For short term extra access, use{' '}
                <Link
                    to="/admin/access/grants"
                    className="font-medium text-maroon-700 underline-offset-2 hover:underline"
                >
                    Temporary access
                </Link>
                .
            </PageHeader>

            {roles.isError ? (
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">
                        The roles did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        size="md"
                        loading={roles.isFetching}
                        onClick={() => void roles.refetch()}
                    >
                        {roles.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            ) : (
                <section className="mt-8" aria-busy={roles.isPending || undefined}>
                    <p className="mb-3 min-h-5 text-sm text-stone-600">
                        {roles.data && (
                            <>
                                <span className="font-semibold text-stone-900 tabular-nums">
                                    {roles.data.length}
                                </span>{' '}
                                roles,{' '}
                                <span className="font-semibold text-stone-900 tabular-nums">
                                    {people}
                                </span>{' '}
                                people
                            </>
                        )}
                    </p>
                    <div className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        {roles.isPending ? (
                            <SkeletonRows />
                        ) : (
                            <>
                                <table className="hidden w-full table-fixed text-left md:table">
                                    <thead className="border-b border-stone-200">
                                        <tr>
                                            <th className={`${headCell} w-[44%]`}>Role</th>
                                            <th className={`${headCell} w-[12%] text-right`}>
                                                People
                                            </th>
                                            <th className={`${headCell} w-[24%]`}>
                                                Admin permissions
                                            </th>
                                            <th className={`${headCell} w-[14%]`}>Type</th>
                                            <th className="w-[6%]">
                                                <span className="sr-only">Open</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {roles.data?.map((r) => (
                                            <tr
                                                key={r.id}
                                                className="group relative transition-colors hover:bg-stone-50"
                                            >
                                                <td className="px-5 py-4">
                                                    <Link
                                                        to={`/admin/access/roles/${r.id}`}
                                                        className="font-semibold text-stone-900 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-maroon-600"
                                                    >
                                                        {r.name}
                                                    </Link>
                                                    <p className="mt-0.5 truncate text-sm text-stone-600">
                                                        {r.description ?? 'No description'}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-right text-sm text-stone-800 tabular-nums">
                                                    {r.members_count}
                                                </td>
                                                <td className="px-5 py-4">
                                                    {catalog.data ? (
                                                        <Reach
                                                            held={reach(r)}
                                                            total={adminCodes.size}
                                                        />
                                                    ) : (
                                                        <span className="block h-4 w-32 animate-pulse rounded bg-stone-200" />
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <RoleTypeChip role={r} />
                                                </td>
                                                <td className="pr-5 text-right">
                                                    <ChevronIcon className="ml-auto size-5 text-stone-400 transition-colors group-hover:text-stone-600" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <ul className="divide-y divide-stone-100 md:hidden">
                                    {roles.data?.map((r) => (
                                        <li key={r.id}>
                                            <Link
                                                to={`/admin/access/roles/${r.id}`}
                                                className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50 active:bg-stone-100"
                                            >
                                                <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                                                    <ShieldIcon className="size-5" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className="truncate font-semibold text-stone-900">
                                                            {r.name}
                                                        </span>
                                                        {!r.is_system && <RoleTypeChip role={r} />}
                                                    </span>
                                                    <span className="block text-sm text-stone-600 tabular-nums">
                                                        {r.members_count}{' '}
                                                        {r.members_count === 1
                                                            ? 'person'
                                                            : 'people'}
                                                        {catalog.data &&
                                                            `, ${reach(r) === adminCodes.size ? 'all' : reach(r)} admin ${reach(r) === 1 ? 'permission' : 'permissions'}`}
                                                    </span>
                                                </span>
                                                <ChevronIcon className="size-5 shrink-0 text-stone-400" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </section>
            )}

            <NewRoleDialog
                key={adding ? 'open' : 'closed'}
                open={adding}
                roles={roles.data ?? []}
                onClose={() => setAdding(false)}
            />
        </div>
    );
}

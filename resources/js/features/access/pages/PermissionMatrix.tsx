// A-Permission matrix. Permissions down the side, roles across the top. Tick a box to give a role
// a permission, then save once. Changed boxes are marked until saved. Locked boxes never change,
// and their reason shows on hover and to screen readers. Desktop first at 1280 px; on smaller
// screens the table scrolls sideways with the permission column pinned.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Link } from 'react-router';
import { listPermissions, listRoles, saveRolePermissions } from '@/features/access/api';
import {
    grouped,
    MatrixCheck,
    PageHeader,
    SaveBar,
    withChanges,
} from '@/features/access/components/ui';
import { LockIcon, SearchIcon } from '@/features/personnel/components/ui';
import { errorMessage, fieldErrors } from '@/features/personnel/people';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

type Pending = Record<number, Record<string, boolean>>;

function Legend() {
    return (
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-600">
            <li className="flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className="flex size-4 items-center justify-center rounded-[4px] bg-maroon-700 text-white"
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="size-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                </span>
                Has it
            </li>
            <li className="flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className="size-4 rounded-[4px] ring-1 ring-stone-300 ring-inset"
                />
                Does not
            </li>
            <li className="flex items-center gap-2">
                <LockIcon className="size-4 text-stone-400" />
                Fixed, hover for why
            </li>
            <li className="flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className="size-4 rounded-[4px] bg-amber-50 ring-1 ring-amber-300 ring-inset"
                />
                Not saved yet
            </li>
        </ul>
    );
}

export function PermissionMatrix() {
    const queryClient = useQueryClient();
    const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
    const catalog = useQuery({ queryKey: ['permissions'], queryFn: listPermissions });
    const [pending, setPending] = useState<Pending>({});
    const [find, setFind] = useState('');

    const changes = Object.values(pending).reduce((n, cells) => n + Object.keys(cells).length, 0);

    const save = useMutation({
        mutationFn: () =>
            saveRolePermissions(
                (roles.data ?? [])
                    .filter((r) => pending[r.id] && Object.keys(pending[r.id]).length > 0)
                    .map((r) => ({ id: r.id, permissions: withChanges(r, pending[r.id]) })),
            ),
        onSuccess: async (fresh) => {
            queryClient.setQueryData(['roles'], fresh);
            await queryClient.invalidateQueries({ queryKey: ['role'] });
            await queryClient.invalidateQueries({ queryKey: ['me'] });
            setPending({});
        },
    });
    const saveError = save.isError
        ? (Object.values(fieldErrors(save.error))[0] ?? errorMessage(save.error))
        : null;

    const toggle = (roleId: number, held: boolean, code: string, on: boolean) => {
        save.reset();
        setPending((current) => {
            const cells = { ...(current[roleId] ?? {}) };
            if (on === held) delete cells[code];
            else cells[code] = on;
            return { ...current, [roleId]: cells };
        });
    };

    const loading = roles.isPending || catalog.isPending;
    const failed = roles.isError || catalog.isError;
    const term = find.trim().toLowerCase();
    const groups =
        roles.data && catalog.data
            ? grouped(
                  catalog.data.data.filter(
                      (p) =>
                          term === '' ||
                          p.label.toLowerCase().includes(term) ||
                          p.description.toLowerCase().includes(term) ||
                          p.code.includes(term),
                  ),
                  catalog.data.groups,
              )
            : [];

    return (
        <div className="mx-auto max-w-[1440px]">
            <PageHeader
                title="Permission matrix"
                actions={
                    <Link
                        to="/admin/access/roles"
                        className="inline-flex min-h-12 items-center justify-center rounded-control border border-stone-300 bg-white px-4 text-base font-semibold text-stone-800 transition-colors hover:bg-stone-50 md:min-h-10 md:text-sm"
                    >
                        Manage roles
                    </Link>
                }
            >
                Who can do what, on one screen. Tick a box to give a role a permission, then save.
                People see the change the next time their app loads.
            </PageHeader>

            {failed ? (
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">
                        The matrix did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={() => {
                            void roles.refetch();
                            void catalog.refetch();
                        }}
                    >
                        Retry
                    </Button>
                </div>
            ) : (
                <section className="mt-8" aria-busy={loading || undefined}>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <label className="block w-full max-w-xs text-sm font-medium text-stone-800">
                            <span className="mb-1.5 block">Find a permission</span>
                            <span className="relative block">
                                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
                                <input
                                    type="search"
                                    value={find}
                                    placeholder="For example, map"
                                    onChange={(e) => setFind(e.target.value)}
                                    className="block min-h-12 w-full rounded-control border border-stone-300 bg-white pr-3 pl-10 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:pl-9 md:text-sm"
                                />
                            </span>
                        </label>
                        <Legend />
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-card bg-white ring-1 ring-stone-200">
                        {loading ? (
                            <div aria-hidden="true" className="space-y-3 p-5">
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        className="h-8 animate-pulse rounded bg-stone-200"
                                    />
                                ))}
                            </div>
                        ) : (
                            <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-left">
                                <thead>
                                    <tr>
                                        <th
                                            scope="col"
                                            className="sticky left-0 z-10 w-80 min-w-64 border-b border-stone-200 bg-white px-5 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase"
                                        >
                                            Permission
                                        </th>
                                        {roles.data?.map((r) => (
                                            <th
                                                key={r.id}
                                                scope="col"
                                                className="min-w-28 border-b border-stone-200 px-2 py-3 text-center align-bottom"
                                            >
                                                <Link
                                                    to={`/admin/access/roles/${r.id}`}
                                                    className="block rounded-control px-1 text-sm font-semibold text-stone-900 underline-offset-2 hover:text-maroon-700 hover:underline"
                                                >
                                                    {r.name}
                                                </Link>
                                                <span className="block text-xs font-normal text-stone-500 tabular-nums">
                                                    {r.members_count}{' '}
                                                    {r.members_count === 1 ? 'person' : 'people'}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={(roles.data?.length ?? 0) + 1}
                                                className="px-5 py-10 text-center text-stone-600"
                                            >
                                                No permission matches "{find.trim()}".
                                            </td>
                                        </tr>
                                    )}
                                    {groups.map(({ group, items }) => (
                                        <Fragment key={group.key}>
                                            <tr>
                                                <th
                                                    scope="colgroup"
                                                    colSpan={(roles.data?.length ?? 0) + 1}
                                                    className="sticky left-0 border-b border-stone-200 bg-stone-50 px-5 pt-4 pb-2 text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase"
                                                >
                                                    {group.label}
                                                </th>
                                            </tr>
                                            {items.map((p) => (
                                                <tr key={p.code} className="group">
                                                    <th
                                                        scope="row"
                                                        className="sticky left-0 z-10 border-b border-stone-100 bg-white px-5 py-2.5 text-left font-normal group-hover:bg-stone-50"
                                                    >
                                                        <span className="block text-sm font-medium text-stone-900">
                                                            {p.label}
                                                        </span>
                                                        <span className="block text-xs text-pretty text-stone-500">
                                                            {p.description}
                                                        </span>
                                                    </th>
                                                    {roles.data?.map((r) => {
                                                        const held = r.permissions.includes(p.code);
                                                        const change = pending[r.id]?.[p.code];
                                                        const lock = r.locks[p.code];
                                                        const on = change ?? held;
                                                        return (
                                                            <td
                                                                key={r.id}
                                                                className="border-b border-stone-100 px-2 py-1 text-center group-hover:bg-stone-50"
                                                            >
                                                                <MatrixCheck
                                                                    on={on}
                                                                    locked={lock !== undefined}
                                                                    changed={change !== undefined}
                                                                    label={`${r.name}: ${p.label}${lock ? `. Locked. ${lock.reason}` : ''}`}
                                                                    title={lock?.reason}
                                                                    onChange={(value) =>
                                                                        toggle(
                                                                            r.id,
                                                                            held,
                                                                            p.code,
                                                                            value,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            )}

            <SaveBar
                changes={changes}
                saving={save.isPending}
                error={saveError}
                onSave={() => save.mutate()}
                onDiscard={() => {
                    save.reset();
                    setPending({});
                }}
            />
        </div>
    );
}

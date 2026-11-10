// A-Grants manager (S2.7). Every grant of extra access, with status tabs. An admin gives new access
// here or ends a grant early. The same actions live on each person's profile.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { listGrants, revokeGrant, type Grant, type GrantStatus } from '@/features/access/api';
import { GiveDialog } from '@/features/access/components/GrantsCard';
import { PlusIcon, chipBase, stamp } from '@/features/personnel/components/ui';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

type Tab = 'active' | 'upcoming' | 'ended' | 'all';

const tabs: { value: Tab; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'ended', label: 'Ended' },
    { value: 'all', label: 'All' },
];

const chips: Record<GrantStatus, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-50 text-green-800 ring-green-200' },
    upcoming: { label: 'Upcoming', className: 'bg-amber-50 text-amber-900 ring-amber-200' },
    ended: { label: 'Ended', className: 'bg-stone-100 text-stone-600 ring-stone-200' },
    revoked: { label: 'Revoked', className: 'bg-stone-100 text-stone-600 ring-stone-200' },
};

const headCell = 'px-4 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase';

function matches(g: Grant, tab: Tab): boolean {
    if (tab === 'all') return true;
    if (tab === 'ended') return g.status === 'ended' || g.status === 'revoked';
    return g.status === tab;
}

export function GrantsManager() {
    const queryClient = useQueryClient();
    const grants = useQuery({ queryKey: ['grants', 'all'], queryFn: () => listGrants() });
    const [tab, setTab] = useState<Tab>('active');
    const [giving, setGiving] = useState(false);
    const [ending, setEnding] = useState<Grant | null>(null);

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['grants'] });
    const revoke = useMutation({
        mutationFn: (id: number) => revokeGrant(id),
        onSuccess: async () => {
            await refresh();
            setEnding(null);
        },
    });

    const all = grants.data ?? [];
    const rows = all.filter((g) => matches(g, tab));
    const count = (t: Tab) => all.filter((g) => matches(g, t)).length;

    return (
        <div className="mx-auto max-w-6xl">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Access</h1>
                    <p className="mt-1 text-stone-600">
                        Time-limited access on top of a role. It stops by itself when it ends.
                    </p>
                </div>
                <Button variant="primary" size="md" onClick={() => setGiving(true)}>
                    <PlusIcon className="size-4" />
                    New grant
                </Button>
            </header>

            <div role="tablist" aria-label="Grant status" className="mt-6 flex flex-wrap gap-2">
                {tabs.map((t) => (
                    <button
                        key={t.value}
                        role="tab"
                        type="button"
                        aria-selected={tab === t.value}
                        onClick={() => setTab(t.value)}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-control px-3 text-sm font-medium ring-1 transition-colors ring-inset ${tab === t.value ? 'bg-maroon-700 text-white ring-maroon-700' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50'}`}
                    >
                        {t.label}
                        {grants.data && (
                            <span className="tabular-nums opacity-80">{count(t.value)}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="mt-4">
                {grants.isPending && (
                    <div
                        aria-hidden="true"
                        className="h-40 animate-pulse rounded-card bg-stone-200"
                    />
                )}
                {grants.isError && (
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-red-700">The grants did not load.</p>
                        <Button variant="secondary" size="md" onClick={() => void grants.refetch()}>
                            Retry
                        </Button>
                    </div>
                )}
                {grants.data && rows.length === 0 && (
                    <div className="rounded-card bg-white p-8 text-center ring-1 ring-stone-200">
                        <p className="font-semibold text-stone-900">No grants here</p>
                        <p className="mt-1 text-sm text-stone-600">
                            Use New grant to give someone extra access for a while.
                        </p>
                    </div>
                )}
                {rows.length > 0 && (
                    <div className="overflow-x-auto rounded-card bg-white ring-1 ring-stone-200">
                        <table className="w-full min-w-[56rem] text-left text-sm">
                            <thead className="border-b border-stone-200">
                                <tr>
                                    <th className={headCell}>Person</th>
                                    <th className={headCell}>Access</th>
                                    <th className={headCell}>When</th>
                                    <th className={headCell}>Reason</th>
                                    <th className={headCell}>Status</th>
                                    <th className={headCell}>
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {rows.map((g) => (
                                    <tr key={g.id} className="align-top">
                                        <td className="px-4 py-3">
                                            <Link
                                                to={`/admin/people/${g.person.id}`}
                                                className="font-medium text-maroon-700 underline-offset-2 hover:underline"
                                            >
                                                {g.person.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-stone-900">
                                                {g.permission.description}
                                            </p>
                                            {g.event && (
                                                <p className="text-stone-600">
                                                    For {g.event.title}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-stone-700 tabular-nums">
                                            {stamp(g.starts_at)}
                                            <br />
                                            to {stamp(g.ends_at)}
                                        </td>
                                        <td className="max-w-xs px-4 py-3 text-pretty text-stone-700">
                                            {g.reason}
                                            <p className="mt-0.5 text-xs text-stone-500">
                                                {g.status === 'revoked'
                                                    ? `Revoked by ${g.revoked_by ?? 'an admin'}`
                                                    : `Given by ${g.granted_by ?? 'an admin'}`}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`${chipBase} ${chips[g.status].className}`}
                                            >
                                                {chips[g.status].label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
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
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <GiveDialog
                key={giving ? 'open' : 'closed'}
                open={giving}
                onClose={() => setGiving(false)}
                onSaved={async () => {
                    await refresh();
                    setGiving(false);
                }}
            />

            <ConfirmDialog
                open={ending !== null}
                tone="danger"
                title="End this access now?"
                description={
                    ending
                        ? `${ending.person.name} loses "${ending.permission.description.toLowerCase()}" straight away. The grant stays in the history.`
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
        </div>
    );
}

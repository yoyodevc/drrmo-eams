// A-People (S2.1). Everyone with an account: pick a role tab, filter, search, open a profile, add a person.
// Desktop first at 1280 px with a table. Under 768 px the rows become a tappable list and the
// filters fold behind a Filters button. Filters live in the URL, so Back from a profile keeps them.
// Volunteer availability is changed on the profile, so there is no separate Volunteer status screen.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
    listDepartments,
    listPeople,
    roleLabels,
    listTeams,
    type PeopleFilters,
    type Person,
    type RoleCode,
} from '@/features/personnel/people';
import { listRequests } from '@/features/personnel/registration';
import {
    AvailabilityChip,
    Avatar,
    ChevronIcon,
    ClockIcon,
    FilterIcon,
    InfoIcon,
    PeopleIcon,
    PlusIcon,
    SearchIcon,
    day,
} from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const PER_PAGE = 25;
// Role is a tab, not a dropdown, so it does not count toward the folded phone filters.
const FILTER_KEYS = ['team', 'department', 'status'] as const;

const tabs: { value: RoleCode | ''; label: string; noun: [string, string] }[] = [
    { value: '', label: 'Everyone', noun: ['person', 'people'] },
    { value: 'volunteer', label: 'Volunteers', noun: ['volunteer', 'volunteers'] },
    { value: 'marshal', label: 'Marshals', noun: ['marshal', 'marshals'] },
    { value: 'coordinator', label: 'Coordinators', noun: ['coordinator', 'coordinators'] },
    { value: 'admin', label: 'Admins', noun: ['admin', 'admins'] },
];

const headCell = 'px-5 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase';
// 48 px and 16 px text on phones so iOS does not zoom; the denser 40 px admin size from 768 px.
const control =
    'block min-h-12 w-full rounded-control border border-stone-300 bg-white px-3 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:text-sm';
const label = 'text-sm font-medium text-stone-800';

function Select({
    name,
    value,
    onChange,
    children,
}: {
    name: string;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
}) {
    return (
        <label className={`${label} block min-w-0 md:w-48`}>
            <span className="mb-1.5 block">{name}</span>
            <select className={control} value={value} onChange={(e) => onChange(e.target.value)}>
                {children}
            </select>
        </label>
    );
}

function roleAndTeam(p: Person): string {
    return [p.role ? roleLabels[p.role] : null, p.team_name].filter(Boolean).join(' · ');
}

function Muted({ children }: { children: ReactNode }) {
    return <span className="text-stone-500">{children}</span>;
}

function SkeletonRows() {
    return (
        <>
            {[0, 1, 2, 3, 4, 5].map((row) => (
                <tr key={row} aria-hidden="true">
                    <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                            <div className="size-10 animate-pulse rounded-full bg-stone-200" />
                            <div>
                                <div className="h-4 w-36 animate-pulse rounded bg-stone-200" />
                                <div className="mt-2 h-3 w-48 animate-pulse rounded bg-stone-200" />
                            </div>
                        </div>
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-5 w-16 animate-pulse rounded-full bg-stone-200" />
                    </td>
                    <td className="px-5 py-3.5">
                        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                    </td>
                    <td className="w-12 px-5 py-3.5" />
                </tr>
            ))}
        </>
    );
}

function SkeletonItems() {
    return (
        <>
            {[0, 1, 2, 3, 4].map((row) => (
                <li key={row} aria-hidden="true" className="flex items-center gap-3 px-4 py-3.5">
                    <div className="size-10 animate-pulse rounded-full bg-stone-200" />
                    <div className="flex-1">
                        <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                        <div className="mt-2 h-3 w-52 animate-pulse rounded bg-stone-200" />
                    </div>
                </li>
            ))}
        </>
    );
}

// Waiting sign ups, so the admin sees there is work on Access requests without opening it.
function PendingRequests() {
    const pending = useQuery({
        queryKey: ['access-requests', 'pending_approval'],
        queryFn: () => listRequests('pending_approval'),
    });
    const count = pending.data?.length ?? 0;
    if (count === 0) return null;

    return (
        <Link
            to="/admin/requests"
            className="mt-6 flex min-h-12 items-center gap-3 rounded-card bg-amber-50 px-4 py-3 ring-1 ring-amber-200 transition-colors ring-inset hover:bg-amber-100/70"
        >
            <ClockIcon className="size-5 shrink-0 text-amber-800" />
            <span className="min-w-0 flex-1 text-sm text-pretty text-amber-950">
                <span className="font-semibold">
                    {count === 1 ? '1 sign up request is' : `${count} sign up requests are`}
                </span>{' '}
                waiting for your review.
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-900">
                Review
                <ChevronIcon className="size-4" />
            </span>
        </Link>
    );
}

export function PeopleList() {
    const [params, setParams] = useSearchParams();
    const filters: PeopleFilters = {
        search: params.get('search') ?? '',
        role: params.get('role') ?? '',
        team: params.get('team') ?? '',
        department: params.get('department') ?? '',
        status: params.get('status') ?? '',
        page: Number(params.get('page')) || 1,
    };
    const list = useQuery({
        queryKey: ['people', filters],
        queryFn: () => listPeople(filters),
        placeholderData: keepPreviousData,
    });
    const departments = useQuery({ queryKey: ['departments'], queryFn: listDepartments });
    const teams = useQuery({ queryKey: ['teams'], queryFn: listTeams });

    const [term, setTerm] = useState(filters.search);
    const [showFilters, setShowFilters] = useState(false);

    const set = (key: keyof PeopleFilters, value: string) => {
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                if (value) next.set(key, value);
                else next.delete(key);
                if (key !== 'page') next.delete('page');
                return next;
            },
            { replace: true },
        );
    };

    // Search waits for a short pause in typing so every key press is not a request.
    useEffect(() => {
        if (term.trim() === filters.search) return;
        const timer = window.setTimeout(() => set('search', term.trim()), 300);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    // Clear keeps the role tab. Switching tabs is a separate choice.
    const clear = () => {
        setTerm('');
        setParams(filters.role ? { role: filters.role } : {}, { replace: true });
    };

    const activeFilters = FILTER_KEYS.filter((key) => filters[key] !== '').length;
    const filtered = activeFilters > 0 || filters.search !== '';
    const rows = list.data?.data ?? [];
    const meta = list.data?.meta;
    const counts = meta?.counts;
    const tab = tabs.find((t) => t.value === filters.role) ?? tabs[0];
    const nobodyYet = list.isSuccess && !filtered && !filters.role && (meta?.total ?? 0) === 0;
    const first = meta ? (meta.page - 1) * PER_PAGE + 1 : 0;
    const last = meta ? Math.min(meta.total, first + rows.length - 1) : 0;
    const noun = (n: number) => tab.noun[n === 1 ? 0 : 1];
    const back = { from: params.toString() ? `?${params.toString()}` : '' };

    const addPerson = (
        <Link
            to="/admin/people/new"
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-control bg-maroon-700 pr-5 pl-4 text-base font-semibold text-white transition-colors hover:bg-maroon-800 active:bg-maroon-900 sm:w-auto md:min-h-10 md:pr-4 md:pl-3 md:text-sm"
        >
            <PlusIcon className="size-5 md:size-4" />
            Add person
        </Link>
    );

    return (
        <div className="mx-auto max-w-[1440px]">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
                <div className="min-w-0">
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        People
                    </h1>
                    <p className="mt-1 max-w-xl text-pretty text-stone-600">
                        Everyone who can sign in. Open a person to see their details, availability
                        and emergency contacts.
                    </p>
                </div>
                {addPerson}
            </header>

            <PendingRequests />

            {list.isError ? (
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">
                        The people list did not load. Check your connection and try again.
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
            ) : nobodyYet ? (
                <div className="mt-8 flex flex-col items-center rounded-card bg-white px-6 py-16 text-center ring-1 ring-stone-200">
                    <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                        <PeopleIcon className="size-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-stone-900">No people yet</h2>
                    <p className="mt-1 max-w-sm text-pretty text-stone-600">
                        Add marshals, volunteers and coordinators here. Each one gets an email to
                        set a password.
                    </p>
                </div>
            ) : (
                <section className="mt-6" aria-busy={list.isPending || undefined}>
                    {/* Role tabs. The number is how many match the other filters. */}
                    {/* On phones the tabs scroll sideways. The fade on the right shows there is more. */}
                    <div className="overflow-x-auto border-b border-stone-200 [mask-image:linear-gradient(to_right,black_80%,transparent)] md:[mask-image:none]">
                        <div
                            className="flex gap-5 pr-8 md:gap-6 md:pr-0"
                            role="group"
                            aria-label="Show role"
                        >
                            {tabs.map((t) => {
                                const selected = t.value === filters.role;
                                const n = counts?.[t.value || 'all'];
                                return (
                                    <button
                                        key={t.label}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => set('role', t.value)}
                                        className={`-mb-px inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 text-base font-semibold whitespace-nowrap transition-colors md:text-sm ${selected ? 'border-maroon-700 text-stone-900' : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'}`}
                                    >
                                        {t.label}
                                        {n !== undefined && (
                                            <span
                                                className={`font-normal tabular-nums ${selected ? 'text-stone-600' : 'text-stone-500'}`}
                                            >
                                                {n}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <form
                        role="search"
                        aria-label="Filter people"
                        onSubmit={(e) => e.preventDefault()}
                        className="mt-5 space-y-3 md:flex md:flex-wrap md:items-end md:gap-3 md:space-y-0"
                    >
                        <div className="flex items-end gap-2 md:min-w-64 md:flex-1">
                            <label className={`${label} block min-w-0 flex-1`}>
                                <span className="mb-1.5 block">Search</span>
                                <span className="relative block">
                                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
                                    <input
                                        type="search"
                                        className={`${control} pl-10 md:pl-9`}
                                        placeholder="Name or email"
                                        value={term}
                                        onChange={(e) => setTerm(e.target.value)}
                                    />
                                </span>
                            </label>
                            <button
                                type="button"
                                aria-expanded={showFilters}
                                aria-controls="people-filters"
                                onClick={() => setShowFilters((open) => !open)}
                                className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-control border px-4 text-base font-semibold transition-colors md:hidden ${showFilters || activeFilters > 0 ? 'border-maroon-700 bg-maroon-50 text-maroon-800' : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50'}`}
                            >
                                <FilterIcon className="size-5" />
                                Filters
                                {activeFilters > 0 && (
                                    <span className="text-sm tabular-nums">
                                        <span className="sr-only">, </span>
                                        {activeFilters}
                                        <span className="sr-only"> on</span>
                                    </span>
                                )}
                            </button>
                        </div>
                        <div
                            id="people-filters"
                            className={`${showFilters ? 'grid' : 'hidden'} grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:contents`}
                        >
                            <Select
                                name="Team"
                                value={filters.team}
                                onChange={(v) => set('team', v)}
                            >
                                <option value="">All teams</option>
                                {teams.data?.map((t) => (
                                    <option key={t.code} value={t.code}>
                                        {t.name}
                                    </option>
                                ))}
                            </Select>
                            <Select
                                name="Department"
                                value={filters.department}
                                onChange={(v) => set('department', v)}
                            >
                                <option value="">All departments</option>
                                {departments.data?.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </Select>
                            <Select
                                name="Availability"
                                value={filters.status}
                                onChange={(v) => set('status', v)}
                            >
                                <option value="">Active and inactive</option>
                                <option value="active">Active only</option>
                                <option value="inactive">Inactive only</option>
                            </Select>
                        </div>
                        {filtered && (
                            <Button
                                variant="ghost"
                                size="md"
                                type="button"
                                onClick={clear}
                                className="max-md:min-h-12 max-md:w-full max-md:text-base"
                            >
                                Clear filters
                            </Button>
                        )}
                    </form>

                    {filters.role === 'volunteer' && (
                        <p className="mt-4 flex gap-2 text-sm text-pretty text-stone-600">
                            <InfoIcon className="size-5 shrink-0 text-stone-500" />
                            <span>
                                Inactive volunteers are not offered when you assign duties. Open a
                                volunteer to set them active or inactive.
                            </span>
                        </p>
                    )}

                    <div className="mt-5 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 md:px-5">
                            <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
                                {list.isPending
                                    ? 'Loading people...'
                                    : meta && meta.total > 0
                                      ? meta.last_page > 1
                                          ? `Showing ${first} to ${last} of ${meta.total} ${noun(meta.total)}`
                                          : `${meta.total} ${noun(meta.total)}`
                                      : `0 ${noun(0)}`}
                            </p>
                            {list.isFetching && !list.isPending && (
                                <p className="text-sm text-stone-500">Updating...</p>
                            )}
                        </div>

                        {list.isSuccess && rows.length === 0 && (
                            <div className="flex flex-col items-center px-5 py-12 text-center">
                                <SearchIcon className="size-6 text-stone-400" />
                                <p className="mt-3 text-stone-700">
                                    {filtered
                                        ? `No ${noun(0)} match these filters.`
                                        : `No ${noun(0)} yet.`}
                                </p>
                                {filtered && (
                                    <button
                                        type="button"
                                        onClick={clear}
                                        className="mt-1 inline-flex min-h-12 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline md:min-h-10"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Phones and small tablets: one tappable row per person. */}
                        {(list.isPending || rows.length > 0) && (
                            <ul className="divide-y divide-stone-100 md:hidden">
                                {list.isPending && <SkeletonItems />}
                                {rows.map((p) => (
                                    <li key={p.id}>
                                        <Link
                                            to={`/admin/people/${p.id}`}
                                            state={back}
                                            className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50 active:bg-stone-100"
                                        >
                                            <Avatar
                                                first={p.first_name}
                                                last={p.last_name}
                                                dim={p.status === 'inactive'}
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="truncate font-semibold text-stone-900">
                                                        {p.name}
                                                    </span>
                                                    {p.status === 'inactive' && (
                                                        <AvailabilityChip status="inactive" />
                                                    )}
                                                </span>
                                                <span className="block truncate text-sm text-stone-600">
                                                    {roleAndTeam(p) || 'No role'}
                                                </span>
                                                <span className="block truncate text-sm text-stone-500">
                                                    {p.email}
                                                </span>
                                            </span>
                                            <ChevronIcon className="size-5 shrink-0 text-stone-400" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* 768 px and up: the full table. The whole row opens the profile. */}
                        {(list.isPending || rows.length > 0) && (
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[860px] text-left">
                                    <thead className="border-b border-stone-200">
                                        <tr>
                                            <th scope="col" className={headCell}>
                                                Person
                                            </th>
                                            <th scope="col" className={headCell}>
                                                Role and team
                                            </th>
                                            <th scope="col" className={headCell}>
                                                Department
                                            </th>
                                            <th scope="col" className={headCell}>
                                                Availability
                                            </th>
                                            <th scope="col" className={headCell}>
                                                Last sign in
                                            </th>
                                            <th scope="col" className="w-12">
                                                <span className="sr-only">Open</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {list.isPending && <SkeletonRows />}
                                        {rows.map((p) => (
                                            <tr
                                                key={p.id}
                                                className="group relative transition-colors hover:bg-stone-50"
                                            >
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            first={p.first_name}
                                                            last={p.last_name}
                                                            dim={p.status === 'inactive'}
                                                        />
                                                        <div className="min-w-0">
                                                            <Link
                                                                to={`/admin/people/${p.id}`}
                                                                state={back}
                                                                className="rounded-sm font-medium text-stone-900 underline-offset-2 transition-colors group-hover:text-maroon-700 after:absolute after:inset-0 hover:underline"
                                                            >
                                                                {p.name}
                                                            </Link>
                                                            <p className="mt-0.5 truncate text-sm text-stone-500">
                                                                {p.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-sm whitespace-nowrap">
                                                    <p className="text-stone-800">
                                                        {p.role ? (
                                                            roleLabels[p.role]
                                                        ) : (
                                                            <Muted>No role</Muted>
                                                        )}
                                                    </p>
                                                    <p className="mt-0.5 text-stone-500">
                                                        {p.team_name ?? 'No team'}
                                                    </p>
                                                </td>
                                                <td className="max-w-64 px-5 py-3 text-sm text-stone-700">
                                                    {p.department?.name ?? <Muted>Not set</Muted>}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <AvailabilityChip status={p.status} />
                                                </td>
                                                <td className="px-5 py-3 text-sm whitespace-nowrap text-stone-700 tabular-nums">
                                                    {day(p.last_login_at) ?? <Muted>Not yet</Muted>}
                                                </td>
                                                <td className="w-12 py-3 pr-4 text-right">
                                                    <ChevronIcon className="inline size-5 text-stone-400 transition-colors group-hover:text-maroon-700" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {meta && meta.last_page > 1 && (
                            <nav
                                aria-label="Pages"
                                className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 md:px-5"
                            >
                                <Button
                                    variant="secondary"
                                    size="md"
                                    className="max-md:min-h-12"
                                    disabled={meta.page <= 1}
                                    onClick={() => set('page', String(meta.page - 1))}
                                >
                                    Previous
                                </Button>
                                <p className="text-sm text-stone-600 tabular-nums">
                                    Page {meta.page} of {meta.last_page}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    className="max-md:min-h-12"
                                    disabled={meta.page >= meta.last_page}
                                    onClick={() => set('page', String(meta.page + 1))}
                                >
                                    Next
                                </Button>
                            </nav>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

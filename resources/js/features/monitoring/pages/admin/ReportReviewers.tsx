// Access control, Report reviewers. An admin picks the (at most 2) marshals who review every site
// report and every emergency, for every event. They get the alerts and can read the reports and
// the emergency inbox. It lives with Access control because it decides who may read.
// Desktop: the reviewer places on the left (they stay in view while you scroll), the marshals to
// pick from on the right. Phones: one column, the places first.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader, SaveBar } from '@/features/access/components/ui';
import { Avatar, SearchIcon } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { getReportReviewers, saveReportReviewers } from '../../api';

type Candidate = { id: string; name: string; email: string };

function nameParts(name: string): [string, string] {
    const parts = name.trim().split(/\s+/);
    return [parts[0] ?? '', parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''];
}

// Line icons, 24 px grid, 1.8 stroke (DESIGN_SYSTEM.md section 6).
function Icon({ className = 'size-5', children }: { className?: string; children: ReactNode }) {
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
            {children}
        </svg>
    );
}
const BellIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0" />
    </Icon>
);
const ReportIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="M8 4.5H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-14a1 1 0 0 0-1-1H16" />
        <path d="M8.5 3.5h7v3h-7zM9 11h6M9 14.5h6M9 18h3.5" />
    </Icon>
);
const InboxIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5Z" />
        <path d="M4 13.5h4.5l1 2h5l1-2H20" />
    </Icon>
);
const MarshalIcon = ({ className }: { className?: string }) => (
    <Icon className={className}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
);

const duties: { icon: ReactNode; text: string }[] = [
    { icon: <BellIcon className="size-5" />, text: 'Get the alert for every new emergency.' },
    { icon: <ReportIcon className="size-5" />, text: 'Read every site report, for every event.' },
    { icon: <InboxIcon className="size-5" />, text: 'Open the emergency inbox and acknowledge.' },
];

// One reviewer place: the person in it, or an empty place with its number.
function Slot({
    index,
    person,
    onRemove,
}: {
    index: number;
    person: Candidate | undefined;
    onRemove: () => void;
}) {
    if (!person) {
        return (
            <li className="flex min-h-20 items-center gap-3 px-4 py-3 sm:px-6">
                <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-stone-300 text-sm font-semibold text-stone-500"
                >
                    {index + 1}
                </span>
                <span className="min-w-0">
                    <span className="block font-medium text-stone-700">
                        Reviewer {index + 1} not set
                    </span>
                    <span className="block text-sm text-stone-500">
                        Tick a marshal in Active marshals.
                    </span>
                </span>
            </li>
        );
    }
    const [first, last] = nameParts(person.name);
    return (
        <li className="flex min-h-20 items-center gap-3 px-4 py-3 sm:px-6">
            <Avatar first={first} last={last} />
            <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold tracking-[0.14em] text-maroon-700 uppercase">
                    Reviewer {index + 1}
                </span>
                <span className="block truncate font-semibold text-stone-900">{person.name}</span>
                <span className="block truncate text-sm text-stone-600">{person.email}</span>
            </span>
            <button
                type="button"
                onClick={onRemove}
                className="inline-flex min-h-12 shrink-0 items-center rounded-control px-3 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 transition-colors ring-inset hover:bg-stone-50 md:min-h-9"
            >
                Remove<span className="sr-only"> {person.name}</span>
            </button>
        </li>
    );
}

function Skeleton() {
    return (
        <div aria-hidden="true" className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="space-y-4 rounded-card bg-white p-6 ring-1 ring-stone-200 lg:col-span-5 xl:col-span-4">
                <div className="h-5 w-32 animate-pulse rounded bg-stone-200" />
                <div className="h-14 animate-pulse rounded bg-stone-200" />
                <div className="h-14 animate-pulse rounded bg-stone-200" />
            </div>
            <div className="space-y-4 rounded-card bg-white p-6 ring-1 ring-stone-200 lg:col-span-7 xl:col-span-8">
                <div className="h-5 w-40 animate-pulse rounded bg-stone-200" />
                {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="h-12 animate-pulse rounded bg-stone-200" />
                ))}
            </div>
        </div>
    );
}

export function ReportReviewers() {
    const queryClient = useQueryClient();
    const settings = useQuery({
        queryKey: ['report-reviewers'],
        queryFn: getReportReviewers,
    });
    const [picked, setPicked] = useState<string[] | null>(null);
    const [search, setSearch] = useState('');
    const save = useMutation({
        mutationFn: (ids: string[]) => saveReportReviewers(ids),
        onSuccess: async () => {
            setPicked(null);
            await queryClient.invalidateQueries({ queryKey: ['report-reviewers'] });
        },
    });

    const header = (
        <PageHeader title="Report reviewers">
            The marshals who read every site report and every emergency, for every event, and get
            the alerts. The same people apply to all events. To let someone read reports for a short
            time instead, use{' '}
            <Link
                to="/admin/access/grants"
                className="font-medium text-maroon-700 underline-offset-2 hover:underline"
            >
                Temporary access
            </Link>
            .
        </PageHeader>
    );

    if (settings.isPending)
        return (
            <div className="mx-auto max-w-[1440px]">
                {header}
                <Skeleton />
            </div>
        );
    if (settings.isError)
        return (
            <div className="mx-auto max-w-[1440px]">
                {header}
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">
                        The reviewers did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        size="md"
                        loading={settings.isFetching}
                        onClick={() => void settings.refetch()}
                    >
                        {settings.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            </div>
        );

    const { max, candidates, user_ids: saved } = settings.data;
    const ids = picked ?? saved;
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const full = ids.length >= max;
    const changes =
        ids.filter((id) => !saved.includes(id)).length +
        saved.filter((id) => !ids.includes(id)).length;
    const toggle = (id: string) => {
        save.reset();
        setPicked(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
    };
    const q = search.trim().toLowerCase();
    const shown = q
        ? candidates.filter(
              (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
          )
        : candidates;

    return (
        <div className="mx-auto max-w-[1440px]">
            {header}

            <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* The places. On desktop they stay in view while the list scrolls. */}
                <div className="space-y-6 lg:sticky lg:top-8 lg:col-span-5 xl:col-span-4">
                    <section
                        aria-labelledby="reviewers-now"
                        className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
                    >
                        <header className="px-4 py-4 sm:px-6">
                            <h2
                                id="reviewers-now"
                                className="flex items-baseline gap-2 text-lg font-semibold text-stone-900"
                            >
                                Reviewers
                                <span className="text-sm font-normal text-stone-500 tabular-nums">
                                    {ids.length} of {max}
                                </span>
                            </h2>
                            <p className="mt-0.5 text-sm text-pretty text-stone-600">
                                {ids.length < max
                                    ? `${ids.length === 0 ? 'No reviewers are set.' : 'Only one reviewer is set.'} Emergencies still go to the admins.`
                                    : 'Both places are filled.'}
                            </p>
                        </header>
                        <ul className="divide-y divide-stone-100 border-t border-stone-200">
                            {Array.from({ length: max }, (_, i) => (
                                <Slot
                                    key={i}
                                    index={i}
                                    person={ids[i] !== undefined ? byId.get(ids[i]) : undefined}
                                    onRemove={() => ids[i] !== undefined && toggle(ids[i])}
                                />
                            ))}
                        </ul>
                        {save.isSuccess && picked === null && (
                            <div className="border-t border-stone-200 px-4 py-4 sm:px-6">
                                <Alert tone="success">Reviewers saved.</Alert>
                            </div>
                        )}
                    </section>

                    <section aria-labelledby="reviewers-do" className="px-1">
                        <h2
                            id="reviewers-do"
                            className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase"
                        >
                            What reviewers can do
                        </h2>
                        <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                            {duties.map((duty) => (
                                <li
                                    key={duty.text}
                                    className="flex items-center gap-3 py-3 text-sm text-stone-700"
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                                        {duty.icon}
                                    </span>
                                    {duty.text}
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>

                <section
                    aria-labelledby="reviewers-pick"
                    className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200 lg:col-span-7 xl:col-span-8"
                >
                    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
                        <div className="min-w-0">
                            <h2
                                id="reviewers-pick"
                                className="flex items-baseline gap-2 text-lg font-semibold text-stone-900"
                            >
                                Active marshals
                                <span className="text-sm font-normal text-stone-500 tabular-nums">
                                    {candidates.length}
                                </span>
                            </h2>
                            <p className="mt-0.5 text-sm text-pretty text-stone-600">
                                {full
                                    ? 'Both places are taken. Remove a reviewer to pick someone else.'
                                    : `Tick up to ${max}. Only marshals can review reports.`}
                            </p>
                        </div>
                        {candidates.length > 0 && (
                            <label className="w-full sm:w-72">
                                <span className="sr-only">Search marshals</span>
                                <span className="relative block">
                                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Name or email"
                                        className="block min-h-12 w-full rounded-control border border-stone-300 bg-white pr-3 pl-10 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:pl-9 md:text-sm"
                                    />
                                </span>
                            </label>
                        )}
                    </header>

                    {candidates.length === 0 ? (
                        <div className="flex flex-col items-center border-t border-stone-200 px-6 py-14 text-center">
                            <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                                <MarshalIcon className="size-6" />
                            </span>
                            <p className="mt-4 font-semibold text-stone-900">
                                No active marshals yet
                            </p>
                            <p className="mt-1 max-w-sm text-sm text-pretty text-stone-600">
                                Give someone the Marshal role in{' '}
                                <Link
                                    to="/admin/people"
                                    className="font-medium text-maroon-700 underline-offset-2 hover:underline"
                                >
                                    People
                                </Link>{' '}
                                first.
                            </p>
                        </div>
                    ) : shown.length === 0 ? (
                        <div className="flex min-h-48 flex-col items-center justify-center border-t border-stone-200 px-6 py-10 text-center">
                            <p className="text-stone-700">No marshal matches "{search.trim()}".</p>
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="mt-2 inline-flex min-h-12 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline md:min-h-0"
                            >
                                Clear search
                            </button>
                        </div>
                    ) : (
                        <ul className="divide-y divide-stone-100 border-t border-stone-200">
                            {shown.map((c) => {
                                const on = ids.includes(c.id);
                                const locked = !on && full;
                                const [first, last] = nameParts(c.name);
                                return (
                                    <li key={c.id}>
                                        <label
                                            className={`flex min-h-16 items-center gap-3 px-4 py-3 transition-colors sm:px-6 ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-stone-50'} ${on ? 'bg-maroon-50 hover:bg-maroon-50' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                disabled={locked}
                                                onChange={() => toggle(c.id)}
                                                className="size-5 shrink-0 accent-maroon-700"
                                            />
                                            <Avatar first={first} last={last} dim={locked} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-medium text-stone-900">
                                                    {c.name}
                                                </span>
                                                <span className="block truncate text-sm text-stone-600">
                                                    {c.email}
                                                </span>
                                            </span>
                                            {on && (
                                                <span className="shrink-0 text-sm font-semibold text-maroon-700">
                                                    Reviewer {ids.indexOf(c.id) + 1}
                                                </span>
                                            )}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>

            <SaveBar
                changes={changes}
                saving={save.isPending}
                error={save.isError ? save.error.message : null}
                onSave={() => save.mutate(ids)}
                onDiscard={() => {
                    save.reset();
                    setPicked(null);
                }}
            />
        </div>
    );
}

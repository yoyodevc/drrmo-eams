// Access control, Report reviewers. An admin picks the (at most 2) marshals who review every site
// report and every emergency, for every event. They get the alerts and can read the reports and
// the emergency inbox. It lives with Access control because it decides who may read.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader, SaveBar } from '@/features/access/components/ui';
import { Avatar, SearchIcon } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { getReportReviewers, saveReportReviewers } from '../../api';

type Candidate = { id: number; name: string; email: string };

function nameParts(name: string): [string, string] {
    const parts = name.trim().split(/\s+/);
    return [parts[0] ?? '', parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''];
}

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
            <div className="flex min-h-20 items-center gap-3 rounded-card border-2 border-dashed border-stone-300 px-4 py-3">
                <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-50 text-sm font-semibold text-stone-400 ring-1 ring-stone-200 ring-inset"
                >
                    {index + 1}
                </span>
                <div>
                    <p className="font-semibold text-stone-700">Reviewer {index + 1} not set</p>
                    <p className="text-sm text-stone-600">Pick a marshal from the list below.</p>
                </div>
            </div>
        );
    }
    const [first, last] = nameParts(person.name);
    return (
        <div className="flex min-h-20 items-center gap-3 rounded-card bg-white px-4 py-3 ring-1 ring-maroon-200">
            <Avatar first={first} last={last} />
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-[0.14em] text-maroon-700 uppercase">
                    Reviewer {index + 1}
                </p>
                <p className="truncate font-semibold text-stone-900">{person.name}</p>
                <p className="truncate text-sm text-stone-600">{person.email}</p>
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-semibold text-stone-700 hover:bg-stone-100"
            >
                Remove<span className="sr-only"> {person.name}</span>
            </button>
        </div>
    );
}

export function ReportReviewers() {
    const queryClient = useQueryClient();
    const settings = useQuery({
        queryKey: ['report-reviewers'],
        queryFn: getReportReviewers,
    });
    const [picked, setPicked] = useState<number[] | null>(null);
    const [search, setSearch] = useState('');
    const save = useMutation({
        mutationFn: (ids: number[]) => saveReportReviewers(ids),
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
            <div className="max-w-3xl">
                {header}
                <div
                    aria-hidden="true"
                    className="mt-8 h-48 animate-pulse rounded-card bg-stone-200"
                />
            </div>
        );
    if (settings.isError)
        return (
            <div className="max-w-3xl">
                {header}
                <div className="mt-8 max-w-xl space-y-3">
                    <Alert tone="error">The reviewers did not load. Check your connection.</Alert>
                    <Button variant="secondary" size="md" onClick={() => void settings.refetch()}>
                        Retry
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
    const toggle = (id: number) => {
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
        <div className="max-w-3xl">
            {header}

            <section aria-labelledby="reviewers-now" className="mt-8">
                <h2 id="reviewers-now" className="text-lg font-semibold text-stone-900">
                    Reviewers
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: max }, (_, i) => (
                        <Slot
                            key={i}
                            index={i}
                            person={ids[i] !== undefined ? byId.get(ids[i]) : undefined}
                            onRemove={() => ids[i] !== undefined && toggle(ids[i])}
                        />
                    ))}
                </div>
                {ids.length < max && (
                    <p className="mt-3 text-sm text-stone-600">
                        {ids.length === 0 ? 'No reviewers are set.' : 'Only one reviewer is set.'}{' '}
                        Emergencies still go to the admins.
                    </p>
                )}
                {save.isSuccess && picked === null && (
                    <div className="mt-3">
                        <Alert tone="success">Reviewers saved.</Alert>
                    </div>
                )}
            </section>

            <section aria-labelledby="reviewers-pick" className="mt-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2
                            id="reviewers-pick"
                            className="flex items-center gap-2 text-lg font-semibold text-stone-900"
                        >
                            Active marshals
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600 tabular-nums">
                                {candidates.length}
                            </span>
                        </h2>
                        <p className="mt-0.5 text-sm text-stone-600">
                            Tick up to {max}. Only marshals can review reports.
                        </p>
                    </div>
                    <label className="w-full sm:w-64">
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
                </div>
                {full && (
                    <p className="mt-2 text-sm text-stone-600">
                        Both places are taken. Remove a reviewer to pick someone else.
                    </p>
                )}

                {candidates.length === 0 ? (
                    <div className="mt-3 rounded-card bg-white p-8 text-center ring-1 ring-stone-200">
                        <p className="font-semibold text-stone-900">No active marshals yet</p>
                        <p className="mt-1 text-sm text-stone-600">
                            Give someone the Marshal role in People first.
                        </p>
                    </div>
                ) : shown.length === 0 ? (
                    <p className="mt-3 text-stone-600">No marshal matches "{search}".</p>
                ) : (
                    <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                        {shown.map((c) => {
                            const on = ids.includes(c.id);
                            const locked = !on && full;
                            const [first, last] = nameParts(c.name);
                            return (
                                <li key={c.id}>
                                    <label
                                        className={`flex min-h-16 items-center gap-3 px-4 py-3 ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-stone-50'} ${on ? 'bg-maroon-50 hover:bg-maroon-50' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={on}
                                            disabled={locked}
                                            onChange={() => toggle(c.id)}
                                            className="size-5 accent-maroon-700"
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
                                            <span className="text-sm font-semibold text-maroon-700">
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

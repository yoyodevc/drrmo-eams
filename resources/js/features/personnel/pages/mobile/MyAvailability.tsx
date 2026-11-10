// M-Availability (S2.4). A volunteer sees if they are active or inactive and why it changed. Read only.
// Opened from the Me tab, so it has a back link there. Mobile first at 360 px.
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { myAvailability, type Availability } from '@/features/personnel/volunteers';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const stamp = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

const labels: Record<Availability, string> = { active: 'Active', inactive: 'Inactive' };

function Chip({ status }: { status: Availability }) {
    const tone =
        status === 'active'
            ? 'bg-green-50 text-green-800 ring-green-200'
            : 'bg-stone-100 text-stone-600 ring-stone-200';
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}
        >
            {labels[status]}
        </span>
    );
}

function Card({ children }: { children: ReactNode }) {
    return <div className="rounded-card bg-white p-4 ring-1 ring-stone-200 md:p-6">{children}</div>;
}

function Skeleton() {
    return (
        <div className="mt-6" aria-busy="true">
            <p role="status" className="sr-only">
                Loading your availability...
            </p>
            <div aria-hidden="true">
                <div className="space-y-3 rounded-card bg-white p-4 ring-1 ring-stone-200">
                    <div className="h-5 w-20 animate-pulse rounded bg-stone-200" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-stone-200" />
                </div>
                <div className="mt-8 h-3 w-16 animate-pulse rounded bg-stone-200" />
                <div className="mt-3 h-20 animate-pulse rounded-card bg-stone-200" />
            </div>
        </div>
    );
}

export function MyAvailability() {
    const query = useQuery({ queryKey: ['my-availability'], queryFn: myAvailability });
    const data = query.data;

    return (
        <div className="mx-auto max-w-2xl">
            <Link
                to="/me/profile"
                className="-mt-2 -ml-2 inline-flex min-h-12 items-center gap-1 rounded-control px-2 text-sm font-medium text-stone-700 transition-colors hover:text-stone-900"
            >
                <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="m15 6-6 6 6 6" />
                </svg>
                Me
            </Link>
            <div className="brand-stripe mt-2 h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                My availability
            </h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                Whether DRRMO can assign you, and every change to it.
            </p>

            {query.isPending && <Skeleton />}

            {query.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        Your availability did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={query.isFetching}
                        onClick={() => void query.refetch()}
                    >
                        {query.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {data && (
                <>
                    <div className="mt-6">
                        <Card>
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-stone-800">Current status</p>
                                <Chip status={data.status} />
                            </div>
                            <p className="mt-2 text-base text-pretty text-stone-700">
                                {data.status === 'active'
                                    ? 'You can be assigned to duties.'
                                    : 'You are not offered for duty while inactive. Contact the DRRMO office to come back.'}
                            </p>
                        </Card>
                    </div>

                    <section aria-labelledby="availability-history" className="mt-8">
                        <h2
                            id="availability-history"
                            className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase"
                        >
                            History
                        </h2>
                        {data.history.length === 0 ? (
                            <p className="mt-2 rounded-card bg-white p-4 text-base text-stone-600 ring-1 ring-stone-200">
                                No changes yet.
                            </p>
                        ) : (
                            <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                                {data.history.map((row) => (
                                    <li key={row.id} className="p-4">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <p className="font-semibold text-stone-900">
                                                Set to {labels[row.new_status].toLowerCase()}
                                            </p>
                                            {row.changed_at && (
                                                <p className="shrink-0 text-sm text-stone-500 tabular-nums">
                                                    {stamp.format(new Date(row.changed_at))}
                                                </p>
                                            )}
                                        </div>
                                        <p className="mt-1 text-base text-pretty text-stone-700">
                                            {row.reason}
                                        </p>
                                        {row.changed_by && (
                                            <p className="mt-1 text-sm text-stone-500">
                                                By {row.changed_by}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

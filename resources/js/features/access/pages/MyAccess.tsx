// M-My access. What a person's role lets them do, in plain words, plus any extra access the office
// gave them for a while. Mobile first at 360 px. Read only: only the DRRMO office changes access.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { hasAdminAccess } from '@/app/adminAccess';
import { useMe } from '@/app/auth';
import { myAccess } from '@/features/access/api';
import { CheckIcon, ShieldIcon } from '@/features/access/components/ui';
import { MyGrants } from '@/features/access/components/MyGrants';
import { BackLink, ChevronIcon } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const eyebrow = 'text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase';

function Skeleton() {
    return (
        <div aria-hidden="true" className="mt-6">
            <div className="h-24 animate-pulse rounded-card bg-stone-200" />
            <div className="mt-8 h-3 w-28 animate-pulse rounded bg-stone-200" />
            <div className="mt-3 h-56 animate-pulse rounded-card bg-stone-200" />
        </div>
    );
}

export function MyAccess() {
    const me = useMe().data;
    const access = useQuery({ queryKey: ['my-access'], queryFn: myAccess });
    const data = access.data;
    const office = data?.permissions.filter((p) => p.admin) ?? [];
    const everyday = data?.permissions.filter((p) => !p.admin) ?? [];

    return (
        <div className="mx-auto max-w-2xl">
            <BackLink to="/me/profile">Me</BackLink>
            <div className="brand-stripe mt-2 h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">My access</h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                What your account lets you do. Only the DRRMO office can change it.
            </p>

            {access.isPending && <Skeleton />}

            {access.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        Your access did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={access.isFetching}
                        onClick={() => void access.refetch()}
                    >
                        {access.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {data && (
                <>
                    <section
                        aria-labelledby="my-role"
                        className="mt-6 flex items-start gap-4 rounded-card bg-white p-4 ring-1 ring-stone-200"
                    >
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-control border border-stone-200 text-maroon-700">
                            <ShieldIcon className="size-6" />
                        </span>
                        <div className="min-w-0">
                            <p className={eyebrow}>Your role</p>
                            <h2 id="my-role" className="mt-1 text-lg font-semibold text-stone-900">
                                {data.role?.name ?? 'No role'}
                            </h2>
                            {data.role?.description && (
                                <p className="mt-0.5 text-sm text-pretty text-stone-600">
                                    {data.role.description}
                                </p>
                            )}
                        </div>
                    </section>

                    {[
                        { key: 'everyday', title: 'Everyday', items: everyday },
                        { key: 'office', title: 'Office screens', items: office },
                    ]
                        .filter((block) => block.items.length > 0)
                        .map((block) => (
                            <section
                                key={block.key}
                                aria-labelledby={`can-${block.key}`}
                                className="mt-8"
                            >
                                <h2 id={`can-${block.key}`} className={eyebrow}>
                                    {block.title}
                                </h2>
                                <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                                    {block.items.map((p) => (
                                        <li
                                            key={p.code}
                                            className="flex items-start gap-3 px-4 py-3"
                                        >
                                            <CheckIcon className="mt-0.5 size-5 shrink-0 text-green-700" />
                                            <span className="min-w-0">
                                                <span className="block font-semibold text-stone-900">
                                                    {p.label}
                                                </span>
                                                <span className="block text-sm text-pretty text-stone-600">
                                                    {p.description}.
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}

                    <MyGrants />

                    {me && hasAdminAccess(me) && (
                        <Link
                            to="/admin"
                            className="mt-8 flex min-h-16 items-center gap-3 rounded-card bg-white px-4 py-3 ring-1 ring-stone-200 transition-colors hover:bg-stone-50 active:bg-stone-100"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-stone-900">
                                    Open the office screens
                                </span>
                                <span className="block text-sm text-pretty text-stone-600">
                                    Your access opens part of the admin side. It works best on a
                                    computer.
                                </span>
                            </span>
                            <ChevronIcon className="size-5 shrink-0 text-stone-400" />
                        </Link>
                    )}

                    <p className="mt-8 text-sm text-pretty text-stone-500">
                        Think something is missing or wrong? Message the DRRMO office.
                    </p>
                </>
            )}
        </div>
    );
}

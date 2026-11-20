// A-Report reviewers. An admin picks the (at most 2) marshals who review every site report and every
// emergency, for every event. They get the alerts and can read the reports and the emergency inbox.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { getReportReviewers, saveReportReviewers } from '../../api';

export function ReportReviewers() {
    const queryClient = useQueryClient();
    const settings = useQuery({ queryKey: ['report-reviewers'], queryFn: getReportReviewers });
    const [picked, setPicked] = useState<number[] | null>(null);
    const save = useMutation({
        mutationFn: (ids: number[]) => saveReportReviewers(ids),
        onSuccess: async () => {
            setPicked(null);
            await queryClient.invalidateQueries({ queryKey: ['report-reviewers'] });
        },
    });

    if (settings.isPending) return <p className="text-stone-600">Loading...</p>;
    if (settings.isError) return <Alert tone="error">The reviewers did not load.</Alert>;

    const { max, candidates } = settings.data;
    const ids = picked ?? settings.data.user_ids;
    const toggle = (id: number) =>
        setPicked(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-max));

    return (
        <div className="mx-auto max-w-2xl">
            <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                Report reviewers
            </h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                Pick up to {max} marshals. They read every site report and every emergency, for
                every event, and get the alerts. The same two people apply to all events.
            </p>

            {ids.length < max && (
                <div className="mt-4">
                    <Alert tone="warning">
                        {ids.length === 0
                            ? 'No reviewers are set.'
                            : `Only ${ids.length} reviewer is set.`}{' '}
                        Emergencies still go to the admins.
                    </Alert>
                </div>
            )}

            <fieldset className="mt-6">
                <legend className="flex w-full items-baseline justify-between">
                    <span className="text-lg font-semibold text-stone-900">Marshals</span>
                    <span className="text-sm text-stone-600 tabular-nums">
                        {ids.length} of {max} picked
                    </span>
                </legend>
                {candidates.length === 0 && (
                    <p className="text-stone-600">There are no active marshals yet.</p>
                )}
                <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                    {candidates.map((c) => (
                        <li key={c.id}>
                            <label
                                className={`flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 ${ids.includes(c.id) ? 'bg-maroon-50' : 'hover:bg-stone-50'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={ids.includes(c.id)}
                                    onChange={() => toggle(c.id)}
                                    className="size-5 accent-maroon-700"
                                />
                                <span>
                                    <span className="block font-medium text-stone-900">
                                        {c.name}
                                    </span>
                                    <span className="block text-sm text-stone-600">{c.email}</span>
                                </span>
                            </label>
                        </li>
                    ))}
                </ul>
            </fieldset>

            {save.isError && (
                <div className="mt-4">
                    <Alert tone="error">{save.error.message}</Alert>
                </div>
            )}
            {save.isSuccess && picked === null && (
                <div className="mt-4">
                    <Alert tone="success">Saved.</Alert>
                </div>
            )}

            <Button
                className="mt-6"
                loading={save.isPending}
                disabled={picked === null}
                onClick={() => save.mutate(ids)}
            >
                Save reviewers
            </Button>
        </div>
    );
}

// A-People import (S2.2). Admin downloads the template, picks a CSV and checks it. Any bad row
// lists its problem by line and nothing is saved. A clean file can then be imported in one go.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { importPeople, type ImportIssue, type ImportResult } from '@/features/personnel/people';
import { BackLink } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const MAX_ROWS = 200;

export function PeopleImport() {
    const queryClient = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [issues, setIssues] = useState<ImportIssue[]>([]);
    const [message, setMessage] = useState('');
    const [checked, setChecked] = useState<number | null>(null);
    const [done, setDone] = useState<ImportResult | null>(null);

    const run = useMutation({
        mutationFn: (check: boolean) => importPeople(file as File, check),
        onSuccess: (res, check) => {
            if (res.ok) {
                setIssues([]);
                setMessage('');
                if (check) setChecked(res.result.count);
                else {
                    setDone(res.result);
                    void queryClient.invalidateQueries({ queryKey: ['people'] });
                }
            } else {
                setChecked(null);
                setIssues(res.issues);
                setMessage(res.message);
            }
        },
        onError: () => {
            setChecked(null);
            setIssues([]);
            setMessage('The upload did not go through. Check your connection and try again.');
        },
    });

    const pick = (next: File | null) => {
        setFile(next);
        setIssues([]);
        setMessage('');
        setChecked(null);
    };

    if (done) {
        const failed = done.invites_failed ?? [];
        return (
            <div className="mx-auto max-w-3xl space-y-4">
                <BackLink to="/admin/people">People</BackLink>
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                    Imported {done.count} {done.count === 1 ? 'person' : 'people'}
                </h1>
                <Alert tone="success">Each person got an email to choose their password.</Alert>
                {failed.length > 0 && (
                    <Alert tone="warning">
                        These emails did not go out. Open each profile and send the invite again:{' '}
                        {failed.join(', ')}.
                    </Alert>
                )}
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <BackLink to="/admin/people">People</BackLink>
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                    Import people
                </h1>
                <p className="mt-1 text-pretty text-stone-600">
                    Upload a CSV with up to {MAX_ROWS} people. Every row is checked first. If one
                    row is wrong, nobody is added.
                </p>
            </header>

            <section className="space-y-3 rounded-card border border-stone-200 bg-white p-5">
                <p className="text-sm text-stone-700">
                    Columns: first_name, last_name, email, contact_number, role, team, department.
                    Role is admin, marshal, coordinator or volunteer. Team and department are
                    matched by name and must exist and be active. Contact number, team and
                    department can stay empty.
                </p>
                <a
                    href="/api/people/import/template"
                    download
                    className="inline-flex min-h-10 items-center font-medium text-maroon-700 underline-offset-2 hover:underline"
                >
                    Download the template
                </a>
            </section>

            <section className="space-y-4 rounded-card border border-stone-200 bg-white p-5">
                <label className="block text-sm font-medium text-stone-800">
                    CSV file
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => pick(e.target.files?.[0] ?? null)}
                        className="mt-2 block w-full text-sm text-stone-700 file:mr-3 file:min-h-10 file:rounded-control file:border file:border-stone-300 file:bg-white file:px-4 file:font-semibold file:text-stone-800"
                    />
                </label>

                {message && <Alert tone="error">{message}</Alert>}
                {checked !== null && (
                    <Alert tone="success">
                        All {checked} {checked === 1 ? 'row looks' : 'rows look'} good. Nothing is
                        saved until you import.
                    </Alert>
                )}

                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="secondary"
                        disabled={!file}
                        loading={run.isPending && run.variables === true}
                        onClick={() => run.mutate(true)}
                    >
                        Check file
                    </Button>
                    <Button
                        disabled={!file || checked === null}
                        loading={run.isPending && run.variables === false}
                        onClick={() => run.mutate(false)}
                    >
                        Import {checked ?? ''} {checked === 1 ? 'person' : 'people'}
                    </Button>
                </div>
            </section>

            {issues.length > 0 && (
                <section
                    aria-label="Problems found"
                    className="overflow-x-auto rounded-card border border-stone-200 bg-white"
                >
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-stone-200 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                                <th className="px-4 py-3">Line</th>
                                <th className="px-4 py-3">Column</th>
                                <th className="px-4 py-3">Problem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {issues.map((issue, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-2.5 whitespace-nowrap text-stone-900">
                                        {issue.row === 0 ? 'File' : issue.row}
                                    </td>
                                    <td className="px-4 py-2.5 whitespace-nowrap text-stone-700">
                                        {issue.field === 'file' ? '' : issue.field}
                                    </td>
                                    <td className="px-4 py-2.5 text-stone-800">{issue.message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </div>
    );
}

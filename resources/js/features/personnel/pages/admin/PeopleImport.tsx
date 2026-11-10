// A-People import (S2.2). Admin downloads the template, picks a CSV and checks it. Any bad row
// lists its problem by line and nothing is saved. A clean file can then be imported in one go.
// Same page frame as the person form: back link, brand stripe, then white cards with a 1 px ring.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { importPeople, type ImportIssue, type ImportResult } from '@/features/personnel/people';
import {
    BackLink,
    CheckCircleIcon,
    DownloadIcon,
    FileIcon,
    UploadIcon,
} from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';

const MAX_ROWS = 200;

const columnNames: Record<string, string> = {
    first_name: 'First name',
    last_name: 'Last name',
    email: 'Email',
    contact_number: 'Contact number',
    role: 'Role',
    team: 'Team',
    department: 'Department',
};

function size(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
    return (
        <section className="rounded-card bg-white p-4 ring-1 ring-stone-200 md:p-6">
            <h2 className="flex items-center gap-3 text-lg font-semibold text-stone-900">
                <span
                    aria-hidden="true"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-sm font-semibold text-maroon-700 ring-1 ring-maroon-700/20 ring-inset"
                >
                    {n}
                </span>
                {title}
            </h2>
            <div className="mt-4">{children}</div>
        </section>
    );
}

export function PeopleImport() {
    const queryClient = useQueryClient();
    const input = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [issues, setIssues] = useState<ImportIssue[]>([]);
    const [message, setMessage] = useState('');
    const [checked, setChecked] = useState<number | null>(null);
    const [done, setDone] = useState<ImportResult | null>(null);
    const [dragging, setDragging] = useState(false);

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
        if (input.current) input.current.value = '';
    };

    const header = (
        <>
            <BackLink to="/admin/people">People</BackLink>
            <div className="brand-stripe mt-2 h-1 w-12 rounded-full" aria-hidden="true" />
        </>
    );

    if (done) {
        const failed = done.invites_failed ?? [];
        return (
            <div className="mx-auto max-w-2xl">
                {header}
                <div className="mt-8 rounded-card bg-white p-6 text-center ring-1 ring-stone-200 md:p-10">
                    <CheckCircleIcon className="mx-auto size-10 text-green-700" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Imported {done.count} {done.count === 1 ? 'person' : 'people'}
                    </h1>
                    <p className="mt-1 text-pretty text-stone-600">
                        Each person got an email with a link to choose their password.
                    </p>
                    {failed.length > 0 && (
                        <div className="mt-5 text-left">
                            <Alert tone="warning">
                                These emails did not go out. Open each profile and send the invite
                                again: {failed.join(', ')}.
                            </Alert>
                        </div>
                    )}
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Link
                            to="/admin/people"
                            className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-maroon-700 px-5 text-base font-semibold text-white transition-colors hover:bg-maroon-800 active:bg-maroon-900 sm:w-auto"
                        >
                            Back to People
                        </Link>
                        <Button
                            variant="secondary"
                            className="w-full sm:w-auto"
                            onClick={() => {
                                setDone(null);
                                pick(null);
                            }}
                        >
                            Import another file
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const rowCount = new Set(issues.filter((i) => i.row > 0).map((i) => i.row)).size;
    const checking = run.isPending && run.variables === true;
    const importing = run.isPending && run.variables === false;

    return (
        <div className="mx-auto max-w-3xl">
            {header}
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                Import people
            </h1>
            <p className="mt-1 text-pretty text-stone-600">
                Add up to {MAX_ROWS} people from a CSV file. Every row is checked first. If one row
                is wrong, nobody is added.
            </p>

            <div className="mt-8 space-y-4">
                <Step n={1} title="Get the template">
                    <p className="text-sm text-stone-700">
                        Role is admin, marshal, coordinator or volunteer. Team and department are
                        matched by name and must exist and be active. Contact number, team and
                        department can stay empty.
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Columns in the file">
                        {Object.keys(columnNames).map((key) => (
                            <li
                                key={key}
                                className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-xs text-stone-700 ring-1 ring-stone-200 ring-inset"
                            >
                                {key}
                            </li>
                        ))}
                    </ul>
                    <a
                        href="/api/people/import/template"
                        download
                        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-5 text-base font-semibold text-stone-800 transition-colors hover:bg-stone-50 active:bg-stone-100 sm:w-auto md:min-h-10 md:px-4 md:text-sm"
                    >
                        <DownloadIcon className="size-5 md:size-4" />
                        Download the template
                    </a>
                </Step>

                <Step n={2} title="Choose your file">
                    <input
                        ref={input}
                        id="people-csv"
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        onChange={(e) => pick(e.target.files?.[0] ?? null)}
                    />
                    {file ? (
                        <div className="flex items-center gap-3 rounded-control bg-stone-50 p-3 ring-1 ring-stone-200">
                            <FileIcon className="size-6 shrink-0 text-maroon-700" />
                            <p className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-stone-900">
                                    {file.name}
                                </span>
                                <span className="block text-sm text-stone-600 tabular-nums">
                                    {size(file.size)}
                                </span>
                            </p>
                            <Button
                                variant="ghost"
                                size="md"
                                disabled={run.isPending}
                                onClick={() => pick(null)}
                            >
                                Remove
                            </Button>
                        </div>
                    ) : (
                        <label
                            htmlFor="people-csv"
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                pick(e.dataTransfer.files[0] ?? null);
                            }}
                            className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-5 py-8 text-center transition-colors focus-within:outline-2 focus-within:outline-maroon-700 ${dragging ? 'border-maroon-700 bg-maroon-50' : 'border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50'}`}
                        >
                            <UploadIcon className="size-7 text-stone-500" />
                            <span className="font-semibold text-stone-900">Choose a CSV file</span>
                            <span className="hidden text-sm text-stone-600 md:block">
                                or drop it here
                            </span>
                        </label>
                    )}
                </Step>

                <Step n={3} title="Check, then import">
                    {message && (
                        <div className="mb-4">
                            <Alert tone="error">{message}</Alert>
                        </div>
                    )}
                    {checked !== null && (
                        <div className="mb-4">
                            <Alert tone="success">
                                All {checked} {checked === 1 ? 'row looks' : 'rows look'} good.
                                Nothing is saved until you import.
                            </Alert>
                        </div>
                    )}
                    {!file && !message && (
                        <p className="mb-4 text-sm text-stone-600">Choose a file to continue.</p>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
                        <Button
                            disabled={!file || checked === null}
                            loading={importing}
                            className="w-full sm:w-auto"
                            onClick={() => run.mutate(false)}
                        >
                            {importing
                                ? 'Importing...'
                                : checked === null
                                  ? 'Import'
                                  : `Import ${checked} ${checked === 1 ? 'person' : 'people'}`}
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={!file}
                            loading={checking}
                            className="w-full sm:w-auto"
                            onClick={() => run.mutate(true)}
                        >
                            {checking ? 'Checking...' : 'Check file'}
                        </Button>
                    </div>
                </Step>

                {issues.length > 0 && (
                    <section
                        aria-labelledby="import-problems"
                        className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
                    >
                        <h2
                            id="import-problems"
                            className="border-b border-stone-200 px-4 py-3 text-sm font-semibold text-stone-900 md:px-6"
                        >
                            {issues.length} {issues.length === 1 ? 'problem' : 'problems'}
                            {rowCount > 0 && ` in ${rowCount} ${rowCount === 1 ? 'row' : 'rows'}`}
                        </h2>
                        <table className="hidden w-full text-left text-sm md:table">
                            <thead>
                                <tr className="border-b border-stone-200 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                                    <th scope="col" className="w-20 px-6 py-3">
                                        Line
                                    </th>
                                    <th scope="col" className="w-44 px-3 py-3">
                                        Column
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        What to fix
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {issues.map((issue, i) => (
                                    <tr key={i} className="hover:bg-stone-50">
                                        <td className="px-6 py-3 text-stone-900 tabular-nums">
                                            {issue.row === 0 ? 'File' : issue.row}
                                        </td>
                                        <td className="px-3 py-3 text-stone-700">
                                            {columnNames[issue.field] ?? ''}
                                        </td>
                                        <td className="px-6 py-3 text-stone-800">
                                            {issue.message}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <ul className="divide-y divide-stone-100 md:hidden">
                            {issues.map((issue, i) => (
                                <li key={i} className="px-4 py-3">
                                    <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                                        {issue.row === 0 ? 'File' : `Line ${issue.row}`}
                                        {columnNames[issue.field] &&
                                            ` · ${columnNames[issue.field]}`}
                                    </p>
                                    <p className="mt-0.5 text-stone-800">{issue.message}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}

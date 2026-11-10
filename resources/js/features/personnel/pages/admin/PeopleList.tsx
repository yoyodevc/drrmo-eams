// A-People (S2.1). Everyone with an account: filter, search, open a profile, add a person.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import {
    listDepartments,
    listPeople,
    roleLabels,
    teamLabels,
    type PeopleFilters,
} from '@/features/personnel/people';
import { Button } from '@/shared/ui/Button';

const selectClass =
    'min-h-10 rounded-control border border-stone-300 bg-white px-3 text-sm text-stone-800 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none';

const start: PeopleFilters = {
    search: '',
    role: '',
    team: '',
    status: '',
    department: '',
    page: 1,
};

function Select({
    label,
    value,
    onChange,
    children,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
}) {
    return (
        <label className="block text-sm font-medium text-stone-700">
            <span className="mb-1 block">{label}</span>
            <select
                className={selectClass}
                value={value}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
            >
                {children}
            </select>
        </label>
    );
}

export function PeopleList() {
    const [filters, setFilters] = useState<PeopleFilters>(start);
    const list = useQuery({
        queryKey: ['people', filters],
        queryFn: () => listPeople(filters),
        placeholderData: keepPreviousData,
    });
    const departments = useQuery({ queryKey: ['departments'], queryFn: listDepartments });

    function set(key: keyof Omit<PeopleFilters, 'page'>) {
        return (value: string) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
    }

    const meta = list.data?.meta;
    const filtered = JSON.stringify({ ...filters, page: 1 }) !== JSON.stringify(start);

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-stone-900">People</h1>
                    <p className="mt-1 text-stone-600">
                        Everyone with an account. New sign up requests are on Access requests.
                    </p>
                </div>
                <Link
                    to="/admin/people/new"
                    className="inline-flex min-h-12 items-center rounded-control bg-maroon-700 px-5 font-semibold text-white transition-colors hover:bg-maroon-800 active:bg-maroon-900"
                >
                    Add person
                </Link>
            </div>

            <form
                role="search"
                onSubmit={(e) => e.preventDefault()}
                className="mt-5 flex flex-wrap items-end gap-3"
            >
                <label className="block min-w-64 flex-1 text-sm font-medium text-stone-700">
                    <span className="mb-1 block">Search</span>
                    <input
                        type="search"
                        value={filters.search}
                        onChange={(e) => set('search')(e.target.value)}
                        placeholder="Name or email"
                        className={`${selectClass} w-full`}
                    />
                </label>
                <Select label="Role" value={filters.role} onChange={set('role')}>
                    <option value="">All roles</option>
                    {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </Select>
                <Select label="Team" value={filters.team} onChange={set('team')}>
                    <option value="">All teams</option>
                    {Object.entries(teamLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </Select>
                <Select label="Department" value={filters.department} onChange={set('department')}>
                    <option value="">All departments</option>
                    {departments.data?.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </Select>
                <Select label="Status" value={filters.status} onChange={set('status')}>
                    <option value="">Any status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </Select>
                {filtered && (
                    <Button size="md" variant="ghost" onClick={() => setFilters(start)}>
                        Clear filters
                    </Button>
                )}
            </form>

            <div className="mt-5 overflow-x-auto rounded-control border border-stone-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-stone-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Role</th>
                            <th className="px-4 py-3 font-medium">Team</th>
                            <th className="px-4 py-3 font-medium">Department</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {list.isPending && (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-stone-500">
                                    Loading...
                                </td>
                            </tr>
                        )}
                        {list.isError && (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-red-700">
                                    Could not load the people.
                                </td>
                            </tr>
                        )}
                        {list.data?.data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-stone-500">
                                    {filtered ? 'Nobody matches these filters.' : 'No people yet.'}
                                </td>
                            </tr>
                        )}
                        {list.data?.data.map((p) => (
                            <tr key={p.id}>
                                <td className="px-4 py-3">
                                    <Link
                                        to={`/admin/people/${p.id}`}
                                        className="font-medium text-maroon-800 hover:underline"
                                    >
                                        {p.name}
                                    </Link>
                                    <p className="text-stone-500">{p.email}</p>
                                </td>
                                <td className="px-4 py-3 text-stone-700">
                                    {p.role ? roleLabels[p.role] : ''}
                                </td>
                                <td className="px-4 py-3 text-stone-700">
                                    {p.team ? teamLabels[p.team] : ''}
                                </td>
                                <td className="px-4 py-3 text-stone-700">
                                    {p.department?.name ?? ''}
                                </td>
                                <td className="px-4 py-3 text-stone-700">
                                    {p.status === 'active' ? 'Active' : 'Inactive'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {meta && (
                <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
                    <p>
                        {meta.total} {meta.total === 1 ? 'person' : 'people'}
                    </p>
                    {meta.last_page > 1 && (
                        <div className="flex items-center gap-2">
                            <Button
                                size="md"
                                variant="secondary"
                                disabled={meta.page <= 1}
                                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                            >
                                Previous
                            </Button>
                            <span>
                                Page {meta.page} of {meta.last_page}
                            </span>
                            <Button
                                size="md"
                                variant="secondary"
                                disabled={meta.page >= meta.last_page}
                                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

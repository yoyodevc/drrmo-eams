// A-Volunteer status (S2.4). Admin sets a volunteer active or inactive with a reason and reads the history.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { personContacts } from '@/features/personnel/contacts';
import {
    listVolunteers,
    setVolunteerStatus,
    statusHistory,
    type Availability,
    type Volunteer,
} from '@/features/personnel/volunteers';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';

const filters: { value: Availability | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
];

function when(value: string | null) {
    return value ? new Date(value).toLocaleString() : '';
}

function History({ volunteer, onClose }: { volunteer: Volunteer; onClose: () => void }) {
    const history = useQuery({
        queryKey: ['volunteer-history', volunteer.id],
        queryFn: () => statusHistory(volunteer.id),
    });

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            className="fixed inset-0 z-10 flex items-center justify-center bg-stone-900/50 p-4"
        >
            <div className="max-h-[80vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-control bg-white p-6">
                <h2 id="history-title" className="text-lg font-semibold text-stone-900">
                    Status history for {volunteer.name}
                </h2>
                {history.isPending && <p className="text-stone-500">Loading...</p>}
                {history.isError && <p className="text-red-700">Could not load the history.</p>}
                {history.data?.length === 0 && <p className="text-stone-500">No changes yet.</p>}
                <ul className="divide-y divide-stone-100">
                    {history.data?.map((row) => (
                        <li key={row.id} className="py-3 text-sm">
                            <p className="font-medium text-stone-900">
                                {row.old_status} to {row.new_status}
                            </p>
                            <p className="text-stone-700">{row.reason}</p>
                            <p className="text-stone-500">
                                {row.changed_by ?? 'Unknown'} · {when(row.changed_at)}
                            </p>
                        </li>
                    ))}
                </ul>
                <div className="flex justify-end">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Contacts({ volunteer, onClose }: { volunteer: Volunteer; onClose: () => void }) {
    const contacts = useQuery({
        queryKey: ['person-contacts', volunteer.id],
        queryFn: () => personContacts(volunteer.id),
    });

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contacts-title"
            className="fixed inset-0 z-10 flex items-center justify-center bg-stone-900/50 p-4"
        >
            <div className="max-h-[80vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-control bg-white p-6">
                <h2 id="contacts-title" className="text-lg font-semibold text-stone-900">
                    Emergency contacts for {volunteer.name}
                </h2>
                {contacts.isPending && <p className="text-stone-500">Loading...</p>}
                {contacts.isError && <p className="text-red-700">Could not load the contacts.</p>}
                {contacts.data?.length === 0 && (
                    <p className="text-stone-500">This person has not added any contacts.</p>
                )}
                <ul className="divide-y divide-stone-100">
                    {contacts.data?.map((c) => (
                        <li key={c.id} className="py-3 text-sm">
                            <p className="font-medium text-stone-900">{c.name}</p>
                            <p className="text-stone-700">{c.relationship}</p>
                            <p className="text-stone-700 tabular-nums">{c.phone}</p>
                        </li>
                    ))}
                </ul>
                <div className="flex justify-end">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function VolunteerStatus() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<Availability | 'all'>('all');
    const [changing, setChanging] = useState<Volunteer | null>(null);
    const [viewing, setViewing] = useState<Volunteer | null>(null);
    const [contactsOf, setContactsOf] = useState<Volunteer | null>(null);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const list = useQuery({
        queryKey: ['volunteers', filter],
        queryFn: () => listVolunteers(filter),
    });

    const change = useMutation({
        mutationFn: ({ volunteer, text }: { volunteer: Volunteer; text: string }) =>
            setVolunteerStatus(
                volunteer.id,
                volunteer.status === 'active' ? 'inactive' : 'active',
                text,
            ),
        onSuccess: () => {
            setChanging(null);
            setReason('');
            return Promise.all([
                queryClient.invalidateQueries({ queryKey: ['volunteers'] }),
                queryClient.invalidateQueries({ queryKey: ['volunteer-history'] }),
            ]);
        },
        onError: () => setError('That did not work. Refresh the list and try again.'),
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        if (changing && reason.trim().length >= 3) {
            setError(null);
            change.mutate({ volunteer: changing, text: reason.trim() });
        }
    }

    const goingInactive = changing?.status === 'active';

    return (
        <div>
            <h1 className="text-2xl font-semibold text-stone-900">Volunteer status</h1>
            <p className="mt-1 text-stone-600">
                Inactive volunteers are not offered when you assign people to duty.
            </p>

            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
                {filters.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => setFilter(item.value)}
                        aria-pressed={filter === item.value}
                        className={`min-h-10 rounded-control border px-3 text-sm font-medium ${filter === item.value ? 'border-maroon-700 bg-maroon-50 text-maroon-800' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mt-4">
                    <Alert tone="error">{error}</Alert>
                </div>
            )}

            <div className="mt-5 overflow-x-auto rounded-control border border-stone-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-stone-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {list.isPending && (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-stone-500">
                                    Loading...
                                </td>
                            </tr>
                        )}
                        {list.isError && (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-red-700">
                                    Could not load the volunteers.
                                </td>
                            </tr>
                        )}
                        {list.data?.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-stone-500">
                                    No volunteers here.
                                </td>
                            </tr>
                        )}
                        {list.data?.map((row) => (
                            <tr key={row.id}>
                                <td className="px-4 py-3 font-medium text-stone-900">{row.name}</td>
                                <td className="px-4 py-3 text-stone-700">{row.email}</td>
                                <td className="px-4 py-3 text-stone-700">
                                    {row.status === 'active' ? 'Active' : 'Inactive'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="md"
                                            variant="secondary"
                                            onClick={() => setContactsOf(row)}
                                            aria-label={`Emergency contacts for ${row.name}`}
                                        >
                                            Contacts
                                        </Button>
                                        <Button
                                            size="md"
                                            variant="secondary"
                                            onClick={() => setViewing(row)}
                                            aria-label={`History for ${row.name}`}
                                        >
                                            History
                                        </Button>
                                        <Button
                                            size="md"
                                            variant="secondary"
                                            onClick={() => {
                                                setChanging(row);
                                                setReason('');
                                                setError(null);
                                            }}
                                            aria-label={`${row.status === 'active' ? 'Set inactive' : 'Set active'}: ${row.name}`}
                                        >
                                            {row.status === 'active'
                                                ? 'Set inactive'
                                                : 'Set active'}
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {contactsOf && <Contacts volunteer={contactsOf} onClose={() => setContactsOf(null)} />}

            {viewing && <History volunteer={viewing} onClose={() => setViewing(null)} />}

            {changing && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="status-title"
                    className="fixed inset-0 z-10 flex items-center justify-center bg-stone-900/50 p-4"
                >
                    <form
                        onSubmit={submit}
                        className="w-full max-w-md space-y-4 rounded-control bg-white p-6"
                    >
                        <h2 id="status-title" className="text-lg font-semibold text-stone-900">
                            {goingInactive ? 'Set inactive' : 'Set active'}: {changing.name}
                        </h2>
                        <TextField
                            label="Reason"
                            hint="Kept in the status history and the audit log."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={255}
                            required
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setChanging(null)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant={goingInactive ? 'danger' : 'primary'}
                                loading={change.isPending}
                                disabled={reason.trim().length < 3}
                            >
                                {goingInactive ? 'Set inactive' : 'Set active'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

// M-Availability (S2.4). A volunteer sees if they are active or inactive and why it changed. Read only.
import { useQuery } from '@tanstack/react-query';
import { myAvailability } from '@/features/personnel/volunteers';
import { Alert } from '@/shared/ui/Alert';

function when(value: string | null) {
    return value ? new Date(value).toLocaleString() : '';
}

export function MyAvailability() {
    const query = useQuery({ queryKey: ['my-availability'], queryFn: myAvailability });

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold text-stone-900">My availability</h1>
            {query.isPending && <p className="text-stone-500">Loading...</p>}
            {query.isError && <Alert tone="error">Could not load your availability.</Alert>}
            {query.data && (
                <>
                    <div className="rounded-control border border-stone-200 bg-white p-4">
                        <p className="text-sm text-stone-600">Current status</p>
                        <p className="text-lg font-semibold text-stone-900">
                            {query.data.status === 'active' ? 'Active' : 'Inactive'}
                        </p>
                        {query.data.status === 'inactive' && (
                            <p className="mt-1 text-sm text-stone-600">
                                You are not offered for duty while inactive. Contact the DRRMO
                                office to come back.
                            </p>
                        )}
                    </div>
                    <h2 className="text-base font-semibold text-stone-900">History</h2>
                    {query.data.history.length === 0 && (
                        <p className="text-stone-500">No changes yet.</p>
                    )}
                    <ul className="divide-y divide-stone-100 rounded-control border border-stone-200 bg-white">
                        {query.data.history.map((row) => (
                            <li key={row.id} className="p-4 text-sm">
                                <p className="font-medium text-stone-900">
                                    {row.old_status} to {row.new_status}
                                </p>
                                <p className="text-stone-700">{row.reason}</p>
                                <p className="text-stone-500">{when(row.changed_at)}</p>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

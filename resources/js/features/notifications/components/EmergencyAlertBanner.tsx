// In app alert for emergencies: a red bar at the top of the screen while the person has an unread
// emergency alert. It links to the emergency inbox and marks the alerts read when opened.
// The server returns nothing for people who are not reviewers, so this is quiet for them.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { listAlerts, markAlertsRead } from '../api';

export function EmergencyAlertBanner({ to }: { to: string }) {
    const queryClient = useQueryClient();
    const alerts = useQuery({
        queryKey: ['in-app-alerts'],
        queryFn: listAlerts,
        refetchInterval: 30_000,
    });
    const read = useMutation({
        mutationFn: markAlertsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['in-app-alerts'] }),
    });

    const unread = (alerts.data?.data ?? []).filter(
        (a) => !a.read && a.emergency_report_id !== null,
    );
    if (unread.length === 0) return null;
    const escalated = unread.some((a) => a.type === 'emergency.escalated');
    const first = unread[0];

    return (
        <div role="alert" className="mb-4 rounded-control bg-red-700 px-4 py-3 text-white">
            <p className="font-semibold">
                {escalated ? 'Emergency not acknowledged' : 'Emergency alert'}
                {unread.length > 1 ? ` (${unread.length} new)` : ''}
            </p>
            <p className="text-sm">
                {first?.about ?? 'Someone on duty'} sent an emergency.{' '}
                <Link to={to} onClick={() => read.mutate()} className="font-semibold underline">
                    Open emergencies
                </Link>
            </p>
        </div>
    );
}

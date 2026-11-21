// The signed in person's in app alerts. One query for the banner and the sound watcher.
// Checks every 30 seconds, or every 10 while an urgent alert is unread.
import { useQuery } from '@tanstack/react-query';
import { listAlerts } from './api';
import { urgencyOf } from './sound';

export const inAppAlertsKey = ['in-app-alerts'] as const;

export function useInAppAlerts() {
    return useQuery({
        queryKey: inAppAlertsKey,
        queryFn: listAlerts,
        refetchInterval: (query) =>
            query.state.data?.data.some((a) => !a.read && urgencyOf(a.type) === 'urgent')
                ? 10_000
                : 30_000,
    });
}

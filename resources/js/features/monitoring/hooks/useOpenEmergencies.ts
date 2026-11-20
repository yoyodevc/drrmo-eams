// Open emergencies for people who review them (`reports.view`). Shares its cache with the inbox's
// "Open" list, so the sidebar count, the Reports tabs and the inbox always agree.
import { useQuery } from '@tanstack/react-query';
import { useMe } from '@/app/auth';
import { listEmergencies } from '../api';

export function useOpenEmergencies() {
    const me = useMe().data;
    const allowed = me?.permissions.includes('reports.view') ?? false;
    const query = useQuery({
        queryKey: ['emergencies', 'open'],
        queryFn: () => listEmergencies('open'),
        enabled: allowed,
        refetchInterval: 15_000,
    });
    const open = allowed ? (query.data ?? []) : [];
    return {
        open,
        // Sent and nobody has taken it on yet.
        waiting: open.filter((e) => e.status === 'sent').length,
        loaded: query.data !== undefined,
    };
}

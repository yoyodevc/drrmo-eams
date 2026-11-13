// Shows whether location sharing works while on duty (S4.2). Logic only, styling comes later.
import { Alert } from '@/shared/ui/Alert';
import { useDutyTracker } from '../hooks/useDutyTracker';

export function TrackingBanner({ assignmentId }: { assignmentId: number }) {
    const { state, pending } = useDutyTracker(assignmentId, true);
    const waiting =
        pending > 0 ? ` ${pending} point${pending === 1 ? '' : 's'} waiting to upload.` : '';

    if (state === 'gps_off') {
        return (
            <Alert tone="error">
                GPS is off or blocked. Turn on location so DRRMO can see you on duty.{waiting}
            </Alert>
        );
    }
    if (state === 'offline') {
        return (
            <Alert tone="error">
                You are offline. Your location is saved and will upload when you reconnect.{waiting}
            </Alert>
        );
    }
    return <p className="text-sm text-pretty text-stone-700">Sharing your location.{waiting}</p>;
}

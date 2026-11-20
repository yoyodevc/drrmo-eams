// Shown on every phone screen while an emergency is queued: it has NOT gone out yet.
import { Button } from '@/shared/ui/Button';
import { useEmergencyOutbox } from '../hooks/useEmergencyOutbox';

export function EmergencyOutboxNotice() {
    const { waiting, flush } = useEmergencyOutbox();
    if (waiting === 0) return null;

    return (
        <div
            role="status"
            className="mb-4 rounded-card border-2 border-amber-400 bg-amber-50 p-4 text-amber-950"
        >
            <p className="text-base font-bold">
                {waiting === 1
                    ? 'Your emergency has not been sent yet'
                    : `${waiting} emergencies have not been sent yet`}
            </p>
            <p className="mt-1 text-sm text-pretty">
                There is no signal. It goes out by itself when you are back online. If it is urgent,
                call your marshal or the DRRMO.
            </p>
            <Button variant="secondary" className="mt-3" block onClick={() => void flush()}>
                Try again now
            </Button>
        </div>
    );
}

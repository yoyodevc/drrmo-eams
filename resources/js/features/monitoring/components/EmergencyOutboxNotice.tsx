// Shown on every phone screen while an emergency is queued: it has NOT gone out yet.
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { useEmergencyOutbox } from '../hooks/useEmergencyOutbox';

export function EmergencyOutboxNotice() {
    const { waiting, flush } = useEmergencyOutbox();
    if (waiting === 0) return null;

    return (
        <div className="mb-4">
            <Alert tone="warning">
                <div>
                    <p className="font-semibold">
                        {waiting === 1
                            ? 'Your emergency has not been sent yet.'
                            : `${waiting} emergencies have not been sent yet.`}
                    </p>
                    <p className="mt-0.5">
                        There is no signal. It will go out by itself when you are back online. If it
                        is urgent, call your marshal or the DRRMO.
                    </p>
                    <Button variant="secondary" className="mt-2" onClick={() => void flush()}>
                        Try again now
                    </Button>
                </div>
            </Alert>
        </div>
    );
}

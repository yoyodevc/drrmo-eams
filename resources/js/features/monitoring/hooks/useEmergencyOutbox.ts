// Sends emergencies that were queued while offline. Runs when the phone comes back online, when the
// app opens, and every 30 seconds while anything waits. A refusal from the server (not a missing
// network) drops the item, so one bad report cannot block the rest.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendEmergency } from '../api';
import { dataUrlToBlob, readEmergencyQueue, removeQueuedEmergency } from '../emergencyQueue';
import { isNetworkError } from '../reportDraft';

export const QUEUE_EVENT = 'eams-emergency-queue';

export function useEmergencyOutbox() {
    const queryClient = useQueryClient();
    const [waiting, setWaiting] = useState(() => readEmergencyQueue().length);
    const busy = useRef(false);

    const flush = useCallback(async () => {
        if (busy.current) return;
        busy.current = true;
        try {
            for (const item of readEmergencyQueue()) {
                try {
                    await sendEmergency({
                        assignmentId: item.assignment_id,
                        clientId: item.client_id,
                        type: item.type,
                        note: item.note,
                        photo: item.photo ? await dataUrlToBlob(item.photo) : null,
                    });
                    removeQueuedEmergency(item.client_id);
                } catch (error) {
                    if (isNetworkError(error)) break;
                    removeQueuedEmergency(item.client_id);
                }
            }
            await queryClient.invalidateQueries({ queryKey: ['my-emergencies'] });
        } finally {
            busy.current = false;
            setWaiting(readEmergencyQueue().length);
        }
    }, [queryClient]);

    useEffect(() => {
        const onQueued = () => {
            setWaiting(readEmergencyQueue().length);
            void flush();
        };
        const onOnline = () => void flush();
        window.addEventListener(QUEUE_EVENT, onQueued);
        window.addEventListener('online', onOnline);
        const timer = window.setInterval(() => {
            if (readEmergencyQueue().length > 0) void flush();
        }, 30_000);
        void flush();
        return () => {
            window.removeEventListener(QUEUE_EVENT, onQueued);
            window.removeEventListener('online', onOnline);
            window.clearInterval(timer);
        };
    }, [flush]);

    return { waiting, flush };
}

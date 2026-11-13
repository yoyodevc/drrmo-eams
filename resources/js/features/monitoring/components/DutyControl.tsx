// Start and end duty buttons on a duty card (S4.1). Start opens 15 minutes before the shift.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { MyAssignment } from '@/features/events/api';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { endDuty, startDuty } from '../api';
import { TrackingBanner } from './TrackingBanner';

const EARLY_MINUTES = 15;
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function DutyControl({ duty }: { duty: MyAssignment }) {
    const queryClient = useQueryClient();
    const done = () => queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
    const start = useMutation({ mutationFn: () => startDuty(duty.id), onSuccess: done });
    const end = useMutation({ mutationFn: () => endDuty(duty.id), onSuccess: done });

    const [now] = useState(() => Date.now());
    const opensAt = new Date(duty.starts_at).getTime() - EARLY_MINUTES * 60_000;
    const endsAt = new Date(duty.ends_at).getTime();
    const failed = start.error ?? end.error;

    if (duty.status === 'on_duty') {
        return (
            <div className="rounded-b-card border-t border-ember-200 bg-ember-50 px-4 py-3">
                <p className="text-sm text-pretty text-stone-700">
                    You are on duty
                    {duty.duty_started_at
                        ? ` since ${clock.format(new Date(duty.duty_started_at))}`
                        : ''}
                    .
                </p>
                <div className="mt-2">
                    <TrackingBanner assignmentId={duty.id} />
                </div>
                {failed && (
                    <div className="mt-3">
                        <Alert tone="error">{failed.message}</Alert>
                    </div>
                )}
                <Button
                    block
                    variant="secondary"
                    className="mt-3"
                    loading={end.isPending}
                    onClick={() => end.mutate()}
                >
                    {end.isPending ? 'Ending...' : 'End duty'}
                </Button>
            </div>
        );
    }

    if (duty.status !== 'assigned' && duty.status !== 'acknowledged') return null;
    if (now >= endsAt) return null;

    const open = now >= opensAt;
    return (
        <div className="rounded-b-card border-t border-stone-100 px-4 py-3">
            {!open && (
                <p className="text-sm text-pretty text-stone-600">
                    You can start duty from {clock.format(new Date(opensAt))}.
                </p>
            )}
            {failed && (
                <div className="mt-3">
                    <Alert tone="error">{failed.message}</Alert>
                </div>
            )}
            <Button
                block
                variant="duty"
                className={open ? '' : 'mt-3'}
                disabled={!open}
                loading={start.isPending}
                onClick={() => start.mutate()}
            >
                {start.isPending ? 'Starting...' : 'Start duty'}
            </Button>
        </div>
    );
}

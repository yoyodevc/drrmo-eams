// Start and end duty buttons on a duty card (S4.1). Start opens 15 minutes before the shift.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useMe } from '@/app/auth';
import type { MyAssignment } from '@/features/events/api';
import { agreeToLocationConsent } from '@/features/records/api';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { endDuty, startDuty } from '../api';
import { TrackingBanner } from './TrackingBanner';

const EARLY_MINUTES = 15;
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function DutyControl({ duty }: { duty: MyAssignment }) {
    const queryClient = useQueryClient();
    const done = () => queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
    const start = useMutation({ mutationFn: () => startDuty(duty.id), onSuccess: done });
    const end = useMutation({ mutationFn: () => endDuty(duty.id), onSuccess: done });
    const me = useMe().data;
    const [asking, setAsking] = useState(false);
    // Agree writes the location consent, refreshes /api/me, then carries on with Start duty.
    const agree = useMutation({
        mutationFn: async () => {
            await agreeToLocationConsent();
            await queryClient.invalidateQueries({ queryKey: ['me'] });
            await startDuty(duty.id);
        },
        onSuccess: () => {
            setAsking(false);
            done();
        },
    });
    const onStart = () => (me && !me.consent.location_tracking ? setAsking(true) : start.mutate());

    const [now] = useState(() => Date.now());
    const opensAt = new Date(duty.starts_at).getTime() - EARLY_MINUTES * 60_000;
    const endsAt = new Date(duty.ends_at).getTime();
    const failed = start.error ?? end.error ?? agree.error;

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
                onClick={onStart}
            >
                {start.isPending ? 'Starting...' : 'Start duty'}
            </Button>
            <ConfirmDialog
                open={asking}
                title="Share your location on duty?"
                description="DRRMO needs your location to keep you safe and see where help is needed."
                confirmLabel="Agree and start duty"
                cancelLabel="Not now"
                loading={agree.isPending}
                loadingLabel="Starting..."
                error={agree.error?.message ?? null}
                onConfirm={() => agree.mutate()}
                onCancel={() => {
                    agree.reset();
                    setAsking(false);
                }}
            >
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-stone-700">
                    <li>When: only while you are on duty and this page is open.</li>
                    <li>Who sees it: DRRMO office staff who are allowed to view locations.</li>
                    <li>How long: kept for 10 working days, then deleted.</li>
                </ul>
                <p className="mt-3 text-sm text-stone-600">
                    You can stop sharing any time from your profile.
                </p>
            </ConfirmDialog>
        </div>
    );
}

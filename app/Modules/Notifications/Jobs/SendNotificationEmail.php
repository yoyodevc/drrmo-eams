<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Events\Models\Assignment;
use App\Modules\Notifications\Contracts\EmailMessage;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\Notification;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/** Sends one notification email. Retries 3 times, then the row shows as failed. */
class SendNotificationEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Times are stored in UTC and shown in Manila time (PROJECT_PLAN A8). */
    private const TIMEZONE = 'Asia/Manila';

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [30, 120];

    public function __construct(public Notification $notification) {}

    public function handle(MailSender $mail): void
    {
        $n = $this->notification->loadMissing(['user', 'subject', 'assignment.event.location', 'assignment.requirement', 'assignment.dutyType']);
        if ($n->status === 'sent' || $n->user === null) {
            return;
        }

        $n->increment('attempts');
        $message = $this->compose($n);
        $mail->send($n->user->email, $n->user->name, $message->subject, $message->text(), $message->html());
        $n->update(['status' => 'sent', 'sent_at' => now(), 'last_error' => null]);
    }

    public function failed(Throwable $e): void
    {
        $this->notification->update(['status' => 'failed', 'last_error' => mb_substr($e->getMessage(), 0, 500)]);
    }

    private function compose(Notification $n): EmailMessage
    {
        if ($n->type === NotificationType::ConsentWithdrawn->value) {
            return $this->composeWithdrawal($n);
        }

        $a = $n->assignment;
        $event = $a?->event->title ?? 'an event';
        $link = url('/').'?assignment='.($a->id ?? '');

        [$subject, $heading, $intro, $preheader] = match ($n->type) {
            NotificationType::AssignmentCreated->value => ['New duty assignment', 'You have a new duty', 'You have been assigned to a duty. Please check the details below.', 'You have been assigned to a duty at '.$event.'.'],
            NotificationType::AssignmentChanged->value => ['Duty assignment changed', 'Your duty was changed', 'Your duty assignment was changed. These are the new details.', 'Your duty at '.$event.' was changed.'],
            NotificationType::ReminderEvening->value => ['Duty reminder', 'Your duty is tomorrow', 'This is a reminder that you are on duty tomorrow. Please check the details below.', 'You are on duty tomorrow at '.$event.'.'],
            NotificationType::ReminderHour->value => ['Duty starts in 1 hour', 'Your duty starts soon', 'Your duty starts in about 1 hour. Please check the details below.', 'Your duty at '.$event.' starts in about 1 hour.'],
            default => ['Duty assignment cancelled', 'Your duty was cancelled', 'Your duty assignment was cancelled. You do not need to report for it.', 'Your duty at '.$event.' was cancelled.'],
        };

        $message = EmailMessage::make($subject.': '.$event, $heading)
            ->preheader($preheader)
            ->greeting($n->user->first_name ?? 'there')
            ->line($intro)
            ->details([
                'Event' => $event,
                'Duty' => $a?->dutyType->name ?? 'a duty',
                'Where' => $a?->event->location->name ?? 'See the app',
                'Shift' => $this->shift($a?->requirement?->shift_starts_at, $a?->requirement?->shift_ends_at),
            ]);

        if ($n->type === NotificationType::AssignmentCancelled->value && $a?->cancel_reason) {
            $message->notice('Reason', $a->cancel_reason);
        }

        return $message->button($n->type === NotificationType::AssignmentCancelled->value ? 'Open DRRMO EAMS' : 'View my duty', $link);
    }

    /** Tells an admin who stopped sharing location and which upcoming duties need a new person. */
    private function composeWithdrawal(Notification $n): EmailMessage
    {
        // The person can be gone (the foreign key is nulled), so the id decides, not the relation.
        $subjectId = $n->subject_user_id;
        $who = $subjectId === null ? 'Someone' : $n->subject->name;
        $duties = $subjectId === null ? collect() : Assignment::query()->live()
            ->where('user_id', $subjectId)
            ->whereIn('status', ['assigned', 'acknowledged'])
            ->whereHas('requirement', fn ($q) => $q->where('shift_ends_at', '>', now()))
            ->with(['event:id,title', 'requirement:id,shift_starts_at,shift_ends_at'])
            ->get()
            ->sortBy(fn (Assignment $a) => $a->requirement?->shift_starts_at)
            ->take(10);

        $message = EmailMessage::make('Location consent withdrawn: '.$who, 'Location consent withdrawn')
            ->preheader($who.' stopped sharing their location.')
            ->greeting($n->user->first_name ?? 'there')
            ->line($who.' withdrew location consent, so they cannot start duty. Reassign their duties if needed.');

        if ($duties->isEmpty()) {
            $message->line('They have no upcoming duties.');
        } else {
            $message->details($duties->mapWithKeys(fn (Assignment $a) => [
                ($a->event->title ?? 'An event').' (#'.$a->id.')' => $this->shift($a->requirement?->shift_starts_at, $a->requirement?->shift_ends_at),
            ])->all());
        }

        return $message->button('Open DRRMO EAMS', url('/admin/events'));
    }

    private function shift(?CarbonInterface $start, ?CarbonInterface $end): string
    {
        if ($start === null) {
            return 'To be confirmed';
        }

        $start = $start->copy()->setTimezone(self::TIMEZONE);
        $text = $start->format('D, M j, Y, g:i A');
        if ($end !== null) {
            $end = $end->copy()->setTimezone(self::TIMEZONE);
            $text .= ' to '.($end->isSameDay($start) ? $end->format('g:i A') : $end->format('D, M j, g:i A'));
        }

        return $text;
    }
}

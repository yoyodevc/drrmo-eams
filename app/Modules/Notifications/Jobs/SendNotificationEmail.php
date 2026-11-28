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
        $n = $this->notification->loadMissing(['user', 'subject', 'siteReport', 'assignment.event.location', 'assignment.requirement', 'assignment.dutyType']);
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
        if ($n->type === NotificationType::ReportOverdue->value) {
            return $this->composeOverdueReport($n);
        }

        if (in_array($n->type, [NotificationType::ReportReminder->value, NotificationType::ReportDue->value, NotificationType::ReportMissed->value], true)) {
            return $this->composeReportNotice($n);
        }
        if (in_array($n->type, [NotificationType::EmergencyReported->value, NotificationType::EmergencyEscalated->value, NotificationType::EmergencyReminder->value], true)) {
            return $this->composeEmergency($n);
        }

        $a = $n->assignment;
        $event = $a?->event->title ?? 'an event';
        $link = url('/').'?assignment='.($a->public_code ?? '');

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

    /** Tells an admin a site report is 15 minutes late, and who owes it. */
    private function composeOverdueReport(Notification $n): EmailMessage
    {
        $who = $n->subject_user_id === null ? 'The reporter' : $n->subject->name;
        $event = $n->assignment->event->title ?? 'an event';
        $due = $n->siteReport === null ? 'To be confirmed' : $n->siteReport->due_at->copy()->setTimezone(self::TIMEZONE)->format('D, M j, g:i A');

        return EmailMessage::make('Site report overdue: '.$event, 'A site report is overdue')
            ->preheader($who.' has not sent the report for '.$event.'.')
            ->greeting($n->user->first_name ?? 'there')
            ->line($who.' has not sent a site report that was due at '.$due.'. It is now more than 15 minutes late.')
            ->details(['Event' => $event, 'Reporter' => $who, 'Due' => $due])
            ->button('Open the reports', url('/admin/reports'));
    }

    /** Reminds the reporter that a report is coming due, or tells the readers that one was missed. */
    private function composeReportNotice(Notification $n): EmailMessage
    {
        $event = $n->assignment->event->title ?? 'an event';
        $due = $n->siteReport === null ? 'To be confirmed' : $n->siteReport->due_at->copy()->setTimezone(self::TIMEZONE)->format('D, M j, g:i A');
        $name = $n->user->first_name ?? 'there';

        if ($n->type === NotificationType::ReportMissed->value) {
            $who = $n->subject_user_id === null ? 'The reporter' : $n->subject->name;

            return EmailMessage::make('Site report missed: '.$event, 'A site report was missed')
                ->preheader($who.' never sent the report for '.$event.'.')
                ->greeting($name)
                ->line($who.' did not send the site report that was due at '.$due.'. It is now closed as missed.')
                ->details(['Event' => $event, 'Reporter' => $who, 'Due' => $due])
                ->button('Open the reports', url('/admin/reports'));
        }

        $now = $n->type === NotificationType::ReportDue->value;

        return EmailMessage::make(($now ? 'Site report due now: ' : 'Site report due soon: ').$event, $now ? 'Your site report is due now' : 'Your site report is due in 15 minutes')
            ->preheader('Your site report for '.$event.' is due at '.$due.'.')
            ->greeting($name)
            ->line($now ? 'Your site report is due now. Please send it as soon as you can.' : 'Your site report is due in 15 minutes. Please get ready to send it.')
            ->details(['Event' => $event, 'Due' => $due])
            ->button('Write the report', url('/me/reports/'.($n->siteReport->public_code ?? '')));
    }

    /** Tells a reviewer or admin that someone on duty sent an emergency. No location in the email: open the app. */
    private function composeEmergency(Notification $n): EmailMessage
    {
        $escalated = $n->type === NotificationType::EmergencyEscalated->value;
        $reminder = $n->type === NotificationType::EmergencyReminder->value;
        $who = $n->subject_user_id === null ? 'Someone on duty' : $n->subject->name;
        $event = $n->assignment->event->title ?? 'an event';

        return EmailMessage::make(($escalated || $reminder ? 'Emergency not acknowledged: ' : 'Emergency: ').$event, $escalated || $reminder ? 'An emergency has not been acknowledged' : 'An emergency was reported')
            ->preheader($who.' sent an emergency at '.$event.'.')
            ->greeting($n->user->first_name ?? 'there')
            ->line($escalated || $reminder ? $who.' sent an emergency and nobody has acknowledged it yet. Please act now.' : $who.' sent an emergency from a duty. Please open it and acknowledge it.')
            ->details(['Event' => $event, 'From' => $who])
            ->button('Open the emergency', url('/'));
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
            // One line for each duty. Two events can share a title, so a repeat is numbered.
            $lines = [];
            foreach ($duties as $a) {
                $title = $label = $a->event->title ?? 'An event';
                for ($i = 2; isset($lines[$label]); $i++) {
                    $label = "{$title} ({$i})";
                }
                $lines[$label] = $this->shift($a->requirement?->shift_starts_at, $a->requirement?->shift_ends_at);
            }
            $message->details($lines);
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

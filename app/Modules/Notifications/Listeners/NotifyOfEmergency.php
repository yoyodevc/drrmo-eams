<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Monitoring\Events\EmergencyEscalated;
use App\Modules\Monitoring\Events\EmergencyReported;
use App\Modules\Monitoring\Services\EmergencyReviewers;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\PermissionHolders;

/**
 * Tells the people who review emergencies, in the app and by email. A new emergency goes to the global
 * reviewer marshals and the admins. An escalated one goes to the admins again. Push can be added here
 * later as one more channel in `alert()`.
 */
class NotifyOfEmergency
{
    public function __construct(private readonly PermissionHolders $holders, private readonly EmergencyReviewers $reviewers) {}

    public function handleReported(EmergencyReported $event): void
    {
        $report = $event->report;
        $people = $this->reviewers->users()->merge($this->holders->of('reports.view'))->unique('id')->reject(fn ($u) => $u->id === $report->user_id);

        foreach ($people as $person) {
            $this->alert($person->id, $report->id, $report->assignment_id, $report->user_id, NotificationType::EmergencyReported);
        }
    }

    public function handleEscalated(EmergencyEscalated $event): void
    {
        $report = $event->report;

        foreach ($this->holders->of('reports.view', null, $report->user_id) as $admin) {
            $this->alert($admin->id, $report->id, $report->assignment_id, $report->user_id, NotificationType::EmergencyEscalated);
        }
    }

    /** One in app alert (shown at once) and one email (queued) for one person. */
    private function alert(int $userId, int $reportId, int $assignmentId, int $subjectId, NotificationType $type): void
    {
        $base = ['user_id' => $userId, 'assignment_id' => $assignmentId, 'emergency_report_id' => $reportId, 'subject_user_id' => $subjectId, 'type' => $type->value];

        Notification::query()->create($base + ['channel' => 'in_app', 'status' => 'sent', 'sent_at' => now()]);
        $email = Notification::query()->create($base + ['channel' => 'email', 'status' => 'queued']);
        SendNotificationEmail::dispatch($email);
    }
}

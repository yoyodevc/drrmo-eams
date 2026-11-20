<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Monitoring\Events\EmergencyEscalated;
use App\Modules\Monitoring\Events\EmergencyReminder;
use App\Modules\Monitoring\Events\EmergencyReported;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Services\EmergencyReviewers;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Services\AlertSender;
use App\Modules\Notifications\Services\PermissionHolders;

/**
 * Tells the people who review emergencies, in the app and by email. A new emergency goes to the reviewer
 * marshals and the admins. A reminder (still unacknowledged after a short wait) goes to the reviewer
 * marshals. An escalated one goes to the admins again.
 */
class NotifyOfEmergency
{
    public function __construct(
        private readonly PermissionHolders $holders,
        private readonly EmergencyReviewers $reviewers,
        private readonly AlertSender $alerts,
    ) {}

    public function handleReported(EmergencyReported $event): void
    {
        $report = $event->report;
        $people = $this->reviewers->users()->merge($this->holders->of('reports.view'))->unique('id')->reject(fn ($u) => $u->id === $report->user_id);

        foreach ($people as $person) {
            $this->alerts->send($person->id, NotificationType::EmergencyReported, $this->about($report));
        }
    }

    public function handleReminder(EmergencyReminder $event): void
    {
        $report = $event->report;

        foreach ($this->reviewers->users()->reject(fn ($u) => $u->id === $report->user_id) as $reviewer) {
            $this->alerts->send($reviewer->id, NotificationType::EmergencyReminder, $this->about($report));
        }
    }

    public function handleEscalated(EmergencyEscalated $event): void
    {
        $report = $event->report;

        foreach ($this->holders->of('reports.view', null, $report->user_id) as $admin) {
            $this->alerts->send($admin->id, NotificationType::EmergencyEscalated, $this->about($report));
        }
    }

    /** @return array{assignment_id: int, emergency_report_id: int, subject_user_id: int} */
    private function about(EmergencyReport $report): array
    {
        return ['assignment_id' => $report->assignment_id, 'emergency_report_id' => $report->id, 'subject_user_id' => $report->user_id];
    }
}

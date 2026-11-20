<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Monitoring\Events\ReportMissed;
use App\Modules\Monitoring\Services\EmergencyReviewers;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Services\AlertSender;
use App\Modules\Notifications\Services\PermissionHolders;

/** Tells the people who read site reports that a report was never sent and is now closed as missed. */
class NotifyOfMissedReport
{
    public function __construct(
        private readonly PermissionHolders $holders,
        private readonly EmergencyReviewers $reviewers,
        private readonly AlertSender $alerts,
    ) {}

    public function handle(ReportMissed $event): void
    {
        $report = $event->report->loadMissing('assignment');
        $about = ['assignment_id' => $report->assignment_id, 'site_report_id' => $report->id, 'subject_user_id' => $report->assignment->user_id];

        $people = $this->reviewers->users()->merge($this->holders->of('reports.view', $report->assignment->event_id))
            ->unique('id')->reject(fn ($u) => $u->id === $report->assignment->user_id);

        foreach ($people as $person) {
            $this->alerts->send($person->id, NotificationType::ReportMissed, $about);
        }
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Monitoring\Events\ReportOverdue;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\PermissionHolders;

/** Emails the people who read site reports when a report is 15 minutes overdue. Once for each of them. */
class NotifyAdminsOfOverdueReport
{
    public function __construct(private readonly PermissionHolders $holders) {}

    public function handle(ReportOverdue $event): void
    {
        $report = $event->report->loadMissing('assignment');

        foreach ($this->holders->of('reports.view', $report->assignment->event_id) as $admin) {
            $notification = Notification::query()->create([
                'user_id' => $admin->id,
                'assignment_id' => $report->assignment_id,
                'site_report_id' => $report->id,
                'subject_user_id' => $report->assignment->user_id,
                'type' => NotificationType::ReportOverdue->value,
                'status' => 'queued',
            ]);
            SendNotificationEmail::dispatch($notification);
        }
    }
}

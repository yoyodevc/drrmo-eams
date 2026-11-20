<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use App\Modules\Monitoring\Enums\ReportStatus;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Services\AlertSender;
use Illuminate\Console\Command;

/**
 * Reminds the designated reporter of each open report slot twice, in the app and by email: 15 minutes
 * before it is due, and again at the due time. Each reminder goes out once. The "before" reminder is
 * skipped once the due time has passed, so nobody gets both at once.
 */
class SendReportReminders extends Command
{
    /** Minutes before the due time for the first reminder. */
    private const BEFORE_MINUTES = 15;

    protected $signature = 'notifications:send-report-reminders';

    protected $description = 'Remind reporters 15 minutes before a report is due and at the due time';

    public function handle(AlertSender $alerts): int
    {
        $now = now();
        $count = 0;

        SiteReport::query()->where('status', ReportStatus::Pending->value)
            ->where('due_at', '<=', $now->copy()->addMinutes(self::BEFORE_MINUTES))
            ->where('due_at', '>', $now->copy()->subMinutes(SiteReport::OVERDUE_AFTER_MINUTES))
            ->with('assignment')->orderBy('id')
            ->each(function (SiteReport $report) use ($alerts, $now, &$count) {
                $userId = $report->assignment->user_id;
                $type = $report->due_at->lte($now) ? NotificationType::ReportDue : NotificationType::ReportReminder;
                if ($alerts->alreadySent($userId, $type, 'site_report_id', $report->id)) {
                    return;
                }
                $alerts->send($userId, $type, ['assignment_id' => $report->assignment_id, 'site_report_id' => $report->id, 'subject_user_id' => $userId]);
                $count++;
            });

        $this->info("Sent {$count} report reminders.");

        return self::SUCCESS;
    }
}

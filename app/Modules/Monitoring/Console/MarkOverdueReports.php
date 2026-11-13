<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Console;

use App\Modules\Monitoring\Enums\ReportStatus;
use App\Modules\Monitoring\Events\ReportOverdue;
use App\Modules\Monitoring\Models\SiteReport;
use Illuminate\Console\Command;

/** Marks report slots overdue 15 minutes after they were due, once, and fires ReportOverdue for each (S4.7). */
class MarkOverdueReports extends Command
{
    protected $signature = 'monitoring:mark-overdue-reports';

    protected $description = 'Mark report slots overdue 15 minutes after they were due';

    public function handle(): int
    {
        $count = 0;
        $cutoff = now()->subMinutes(SiteReport::OVERDUE_AFTER_MINUTES);

        SiteReport::query()->where('status', ReportStatus::Pending->value)->where('due_at', '<=', $cutoff)
            ->orderBy('id')->each(function (SiteReport $report) use (&$count) {
                // The status is checked again in the update, so two runs at once cannot both announce it.
                $changed = SiteReport::query()->whereKey($report->id)->where('status', ReportStatus::Pending->value)
                    ->update(['status' => ReportStatus::Overdue->value, 'overdue_at' => now()]);
                if ($changed > 0) {
                    $count++;
                    ReportOverdue::dispatch($report->refresh());
                }
            });

        $this->info("Marked {$count} reports overdue.");

        return self::SUCCESS;
    }
}

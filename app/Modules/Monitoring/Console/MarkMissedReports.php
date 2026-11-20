<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Console;

use App\Modules\Monitoring\Enums\ReportStatus;
use App\Modules\Monitoring\Events\ReportMissed;
use App\Modules\Monitoring\Models\SiteReport;
use Illuminate\Console\Command;

/** Closes report slots as missed when nobody filled them an hour after they were due, once, and fires ReportMissed. */
class MarkMissedReports extends Command
{
    protected $signature = 'monitoring:mark-missed-reports';

    protected $description = 'Mark report slots missed when still empty an hour after they were due';

    public function handle(): int
    {
        $count = 0;
        $cutoff = now()->subMinutes(SiteReport::MISSED_AFTER_MINUTES);
        $open = [ReportStatus::Pending->value, ReportStatus::Overdue->value];

        SiteReport::query()->whereIn('status', $open)->where('due_at', '<=', $cutoff)->orderBy('id')
            ->each(function (SiteReport $report) use (&$count, $open) {
                // The status is checked again in the update, so a report sent a second ago is not closed.
                $changed = SiteReport::query()->whereKey($report->id)->whereIn('status', $open)
                    ->update(['status' => ReportStatus::Missed->value, 'missed_at' => now()]);
                if ($changed > 0) {
                    $count++;
                    ReportMissed::dispatch($report->refresh());
                }
            });

        $this->info("Marked {$count} reports missed.");

        return self::SUCCESS;
    }
}

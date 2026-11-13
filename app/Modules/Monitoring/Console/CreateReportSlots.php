<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Console;

use App\Modules\Events\Models\Assignment;
use App\Modules\Monitoring\Enums\ReportStatus;
use App\Modules\Monitoring\Events\ReportSlotCreated;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Monitoring\Services\ReportSchedule;
use Illuminate\Console\Command;

/**
 * Creates the report slots that are about to fall due. A designated reporter is a person who holds an
 * active, event scoped `reports.submit` grant for an event and also has a live assignment in it
 * (docs/PROJECT_PLAN.md A4 and A5). Running it again never makes a second slot.
 */
class CreateReportSlots extends Command
{
    /** A slot appears this long before it is due, so the reporter can see it coming. */
    private const LEAD_MINUTES = 15;

    protected $signature = 'monitoring:create-report-slots';

    protected $description = 'Create report slots for designated reporters';

    public function handle(ReportSchedule $schedule): int
    {
        $now = now();
        $created = 0;

        $assignments = Assignment::query()->live()
            ->whereIn('status', ['assigned', 'acknowledged', 'on_duty'])
            ->whereExists(fn ($q) => $q->from('permission_grants as g')
                ->join('permissions as p', 'p.id', '=', 'g.permission_id')
                ->whereColumn('g.user_id', 'assignments.user_id')
                ->whereColumn('g.event_id', 'assignments.event_id')
                ->where('p.code', 'reports.submit')
                ->whereNull('g.revoked_at')->where('g.starts_at', '<=', $now)->where('g.ends_at', '>', $now))
            ->with(['event', 'requirement'])
            ->get();

        foreach ($assignments as $assignment) {
            $start = $assignment->requirement !== null ? $assignment->requirement->shift_starts_at : $assignment->event->starts_at;
            $end = $assignment->requirement !== null ? $assignment->requirement->shift_ends_at : $assignment->event->ends_at;

            // Nothing is made for a shift that is long over.
            if ($now->gt($end->copy()->addMinutes(SiteReport::OVERDUE_AFTER_MINUTES))) {
                continue;
            }

            foreach ($schedule->dueTimes($start, $end) as $due) {
                if ($due->gt($now->copy()->addMinutes(self::LEAD_MINUTES))) {
                    continue;
                }
                $report = SiteReport::query()->firstOrCreate(
                    ['assignment_id' => $assignment->id, 'due_at' => $due],
                    ['status' => ReportStatus::Pending],
                );
                if ($report->wasRecentlyCreated) {
                    $created++;
                    ReportSlotCreated::dispatch($report);
                }
            }
        }

        $this->info("Created {$created} report slots.");

        return self::SUCCESS;
    }
}

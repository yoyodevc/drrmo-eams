<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Console;

use App\Modules\Monitoring\Enums\EmergencyStatus;
use App\Modules\Monitoring\Events\EmergencyEscalated;
use App\Modules\Monitoring\Models\EmergencyReport;
use Illuminate\Console\Command;

/** Escalates an emergency nobody acknowledged within the set minutes, once, and fires EmergencyEscalated. */
class EscalateEmergencies extends Command
{
    protected $signature = 'monitoring:escalate-emergencies';

    protected $description = 'Escalate emergencies that nobody acknowledged in time';

    public function handle(): int
    {
        $count = 0;
        $cutoff = now()->subMinutes((int) config('emergency.escalate_after_minutes', 5));

        EmergencyReport::query()->where('status', EmergencyStatus::Sent->value)->whereNull('escalated_at')
            ->where('created_at', '<=', $cutoff)->orderBy('id')->each(function (EmergencyReport $report) use (&$count) {
                // Checked again in the update, so two runs at once cannot both announce it.
                $changed = EmergencyReport::query()->whereKey($report->id)->where('status', EmergencyStatus::Sent->value)
                    ->whereNull('escalated_at')->update(['escalated_at' => now()]);
                if ($changed > 0) {
                    $count++;
                    EmergencyEscalated::dispatch($report->refresh());
                }
            });

        $this->info("Escalated {$count} emergencies.");

        return self::SUCCESS;
    }
}

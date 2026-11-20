<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Console;

use App\Modules\Monitoring\Enums\EmergencyStatus;
use App\Modules\Monitoring\Events\EmergencyReminder;
use App\Modules\Monitoring\Models\EmergencyReport;
use Illuminate\Console\Command;

/** Reminds the reviewers once when an emergency is still unacknowledged after a short wait (before it escalates). */
class RemindEmergencies extends Command
{
    protected $signature = 'monitoring:remind-emergencies';

    protected $description = 'Remind the reviewers about emergencies nobody has acknowledged yet';

    public function handle(): int
    {
        $count = 0;
        $cutoff = now()->subMinutes((int) config('emergency.remind_after_minutes', 2));

        EmergencyReport::query()->where('status', EmergencyStatus::Sent->value)->whereNull('reminded_at')
            ->where('created_at', '<=', $cutoff)->orderBy('id')->each(function (EmergencyReport $report) use (&$count) {
                $changed = EmergencyReport::query()->whereKey($report->id)->where('status', EmergencyStatus::Sent->value)
                    ->whereNull('reminded_at')->update(['reminded_at' => now()]);
                if ($changed > 0) {
                    $count++;
                    EmergencyReminder::dispatch($report->refresh());
                }
            });

        $this->info("Reminded about {$count} emergencies.");

        return self::SUCCESS;
    }
}

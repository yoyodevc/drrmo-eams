<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Events;

use App\Modules\Monitoring\Models\EmergencyReport;
use Illuminate\Foundation\Events\Dispatchable;

/** A person on duty sent an emergency. Fired once for each report. */
class EmergencyReported
{
    use Dispatchable;

    public function __construct(public readonly EmergencyReport $report) {}
}

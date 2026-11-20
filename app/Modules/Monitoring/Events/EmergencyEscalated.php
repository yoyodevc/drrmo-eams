<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Events;

use App\Modules\Monitoring\Models\EmergencyReport;
use Illuminate\Foundation\Events\Dispatchable;

/** An emergency was not acknowledged in time. Fired once for each report. */
class EmergencyEscalated
{
    use Dispatchable;

    public function __construct(public readonly EmergencyReport $report) {}
}

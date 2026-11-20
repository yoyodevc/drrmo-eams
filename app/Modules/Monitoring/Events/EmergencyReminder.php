<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Events;

use App\Modules\Monitoring\Models\EmergencyReport;
use Illuminate\Foundation\Events\Dispatchable;

/** An emergency is still unacknowledged after a short wait. The reviewers are reminded, once for each report. */
class EmergencyReminder
{
    use Dispatchable;

    public function __construct(public readonly EmergencyReport $report) {}
}

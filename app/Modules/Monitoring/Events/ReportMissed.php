<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Events;

use App\Modules\Monitoring\Models\SiteReport;
use Illuminate\Foundation\Events\Dispatchable;

/** A report slot was never filled and is now closed as missed. Fired once for each slot. */
class ReportMissed
{
    use Dispatchable;

    public function __construct(public readonly SiteReport $report) {}
}

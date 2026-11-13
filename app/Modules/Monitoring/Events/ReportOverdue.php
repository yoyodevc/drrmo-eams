<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Events;

use App\Modules\Monitoring\Models\SiteReport;
use Illuminate\Foundation\Events\Dispatchable;

/** A report slot is 15 minutes past due and still empty. Fired once for each slot. */
class ReportOverdue
{
    use Dispatchable;

    public function __construct(public readonly SiteReport $report) {}
}

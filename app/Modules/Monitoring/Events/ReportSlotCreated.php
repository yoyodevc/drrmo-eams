<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Events;

use App\Modules\Monitoring\Models\SiteReport;
use Illuminate\Foundation\Events\Dispatchable;

class ReportSlotCreated
{
    use Dispatchable;

    public function __construct(public readonly SiteReport $report) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Enums;

enum ReportStatus: string
{
    case Pending = 'pending';
    case Submitted = 'submitted';
    case Overdue = 'overdue';
    case Late = 'late';
}

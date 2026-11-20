<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Enums;

enum EmergencyStatus: string
{
    case Sent = 'sent';
    case Acknowledged = 'acknowledged';
    case Resolved = 'resolved';
}

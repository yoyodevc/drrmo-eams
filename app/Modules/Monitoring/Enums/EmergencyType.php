<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Enums;

enum EmergencyType: string
{
    case Medical = 'medical';
    case Fire = 'fire';
    case Security = 'security';
    case Other = 'other';
}

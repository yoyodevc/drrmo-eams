<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

/** Urgent: push and a repeating alarm. Important: push and one chime. Normal: in app and email only. */
enum Urgency: string
{
    case Urgent = 'urgent';
    case Important = 'important';
    case Normal = 'normal';
}

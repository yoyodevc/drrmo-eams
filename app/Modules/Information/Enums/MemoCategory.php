<?php

declare(strict_types=1);

namespace App\Modules\Information\Enums;

/** Memo groups shown as chips on the memo search screen. The docs leave the list open, so DRRMO may rename these. */
enum MemoCategory: string
{
    case Policy = 'policy';
    case Procedure = 'procedure';
    case Advisory = 'advisory';
    case Training = 'training';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Policy => 'Policy',
            self::Procedure => 'Procedure',
            self::Advisory => 'Advisory',
            self::Training => 'Training',
            self::Other => 'Other',
        };
    }
}

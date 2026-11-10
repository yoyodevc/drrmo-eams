<?php

declare(strict_types=1);

namespace App\Modules\Access\Events;

use App\Modules\Access\Models\PermissionGrant;
use Illuminate\Foundation\Events\Dispatchable;

class PermissionGranted
{
    use Dispatchable;

    public function __construct(public readonly PermissionGrant $grant) {}
}

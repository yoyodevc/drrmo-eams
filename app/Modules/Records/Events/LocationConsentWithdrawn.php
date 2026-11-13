<?php

declare(strict_types=1);

namespace App\Modules\Records\Events;

use App\Modules\Personnel\Models\User;
use Illuminate\Foundation\Events\Dispatchable;

/** A person stopped sharing their location. Fired only when an open consent was actually withdrawn. */
class LocationConsentWithdrawn
{
    use Dispatchable;

    public function __construct(public readonly User $user) {}
}

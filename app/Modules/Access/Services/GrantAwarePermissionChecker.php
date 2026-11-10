<?php

declare(strict_types=1);

namespace App\Modules\Access\Services;

use App\Modules\Access\Contracts\PermissionChecker;
use App\Modules\Personnel\Models\User;

class GrantAwarePermissionChecker implements PermissionChecker
{
    public function allows(User $user, string $code, ?int $eventId = null): bool
    {
        if ($user->role?->permissions->contains('code', $code)) {
            return true;
        }

        // Loaded once per user object, so one request asks the database once.
        return $user->loadMissing('activeGrants')->activeGrants->contains(
            fn ($grant) => $grant->permission->grantable
                && $grant->permission->code === $code
                && ($grant->event_id === null || $grant->event_id === $eventId),
        );
    }
}

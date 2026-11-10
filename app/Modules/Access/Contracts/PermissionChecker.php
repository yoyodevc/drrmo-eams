<?php

declare(strict_types=1);

namespace App\Modules\Access\Contracts;

use App\Modules\Personnel\Models\User;

/** The one place that answers "may this person do this?". Policies and controllers call it through User::hasPermission(). */
interface PermissionChecker
{
    /**
     * True when the person's role holds the permission, or they have an active grant for it.
     * An active grant has starts_at <= now < ends_at and is not revoked. Its event must be
     * empty or equal to $eventId. A grant tied to one event never answers a question with no event.
     */
    public function allows(User $user, string $code, ?int $eventId = null): bool;
}

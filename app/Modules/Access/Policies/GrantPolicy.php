<?php

declare(strict_types=1);

namespace App\Modules\Access\Policies;

use App\Modules\Personnel\Models\User;

/** Only people with access.manage (admins) list, create and revoke grants. */
class GrantPolicy
{
    public function manage(User $actor): bool
    {
        return $actor->hasPermission('access.manage');
    }
}

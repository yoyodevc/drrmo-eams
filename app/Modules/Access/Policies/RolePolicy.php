<?php

declare(strict_types=1);

namespace App\Modules\Access\Policies;

use App\Modules\Personnel\Models\User;

class RolePolicy
{
    /** Roles, the permission matrix and moving people between roles. Admin only (access.manage cannot be granted). */
    public function manage(User $actor): bool
    {
        return $actor->hasPermission('access.manage');
    }

    /** The short role list behind the role filter and the role field on the People screens. */
    public function pick(User $actor): bool
    {
        return $actor->hasPermission('people.view') || $actor->hasPermission('people.manage');
    }
}

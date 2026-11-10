<?php

declare(strict_types=1);

namespace App\Modules\Access\Contracts;

use App\Modules\Access\Models\Role;
use App\Modules\Personnel\Models\User;

/**
 * Stops anyone from handing out more power than they hold. Personnel calls it before it creates,
 * edits or imports a person with a role, and Access calls it before it moves people between roles.
 */
interface RoleGuard
{
    /**
     * True when every admin permission of the role is one the actor holds right now (by role or by
     * an active grant that is not tied to one event). Self service permissions are not compared,
     * so a people manager can still add volunteers. Nobody but an admin holds access.manage, so
     * nobody but an admin can create, edit or demote an admin.
     */
    public function canHandOut(User $actor, Role $role): bool;
}

<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Contracts;

use App\Modules\Access\Models\Role;
use App\Modules\Personnel\Models\User;

/** Personnel owns users.role_id. Access moves people between roles through this contract. */
interface PersonRoleChanger
{
    /** Puts the person in the role and writes a person.role_changed audit row. Does nothing when nothing changes. */
    public function change(User $person, Role $role): void;
}

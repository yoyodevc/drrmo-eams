<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Actions;

use App\Modules\Access\Models\Role;
use App\Modules\Personnel\Contracts\PersonRoleChanger;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;

class ChangePersonRole implements PersonRoleChanger
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function change(User $person, Role $role): void
    {
        $before = $person->loadMissing('role')->role?->code;
        if ($before === $role->code) {
            return;
        }

        $person->role_id = $role->id;
        $person->save();
        $person->setRelation('role', $role);

        $this->audit->log('person.role_changed', $person, meta: ['before' => ['role' => $before], 'after' => ['role' => $role->code]]);
    }
}

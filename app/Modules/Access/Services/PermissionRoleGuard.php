<?php

declare(strict_types=1);

namespace App\Modules\Access\Services;

use App\Modules\Access\Contracts\RoleGuard;
use App\Modules\Access\Models\Role;
use App\Modules\Access\Support\PermissionMatrix;
use App\Modules\Personnel\Models\User;

class PermissionRoleGuard implements RoleGuard
{
    public function canHandOut(User $actor, Role $role): bool
    {
        $admin = PermissionMatrix::adminCodes();
        $needed = $role->loadMissing('permissions')->permissions->pluck('code')
            ->filter(fn ($code) => in_array($code, $admin, true));

        return $needed->every(fn ($code) => $actor->hasPermission((string) $code));
    }
}

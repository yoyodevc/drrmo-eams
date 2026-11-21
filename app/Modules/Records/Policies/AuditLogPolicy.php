<?php

declare(strict_types=1);

namespace App\Modules\Records\Policies;

use App\Modules\Personnel\Models\User;

/** Reading the audit log needs `audit.view`. There is no create, update or delete. */
class AuditLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('audit.view');
    }
}

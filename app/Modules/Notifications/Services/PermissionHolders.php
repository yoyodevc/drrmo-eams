<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Personnel\Models\User;
use Illuminate\Support\Collection;

/** Finds the active people who hold a permission through their role or an active grant, to send them a notice. */
class PermissionHolders
{
    /** @return Collection<int, User> */
    public function of(string $permission, ?int $eventId = null, ?int $exceptUserId = null): Collection
    {
        return User::query()
            ->where('account_status', 'active')->whereNull('disabled_at')
            ->when($exceptUserId, fn ($q) => $q->whereKeyNot($exceptUserId))
            ->where(fn ($q) => $q
                ->whereHas('role.permissions', fn ($p) => $p->where('code', $permission))
                ->orWhereHas('grants', fn ($g) => $g->active()))
            ->get()
            ->filter(fn (User $u) => $u->hasPermission($permission, $eventId))
            ->values();
    }
}

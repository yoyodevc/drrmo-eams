<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Services;

use App\Modules\Personnel\Models\User;
use Illuminate\Support\Collection;

/**
 * The marshals who review every emergency, whatever the event. Read from config for now; the
 * settings screen (report rework step 2) will replace only the source of the ids.
 */
class EmergencyReviewers
{
    /** @return list<int> */
    public function ids(): array
    {
        return array_values(array_map('intval', (array) config('emergency.reviewer_ids', [])));
    }

    public function includes(User $user): bool
    {
        return in_array($user->id, $this->ids(), true);
    }

    /** @return Collection<int, User> Active reviewers only. */
    public function users(): Collection
    {
        return User::query()->whereKey($this->ids())->where('account_status', 'active')->whereNull('disabled_at')->get();
    }
}

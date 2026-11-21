<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Policies;

use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Personnel\Models\User;

/** Everyone manages their own devices and nobody else's. */
class PushSubscriptionPolicy
{
    public function create(User $user): bool
    {
        return true;
    }

    public function delete(User $user, PushSubscription $subscription): bool
    {
        return $subscription->user_id === $user->id;
    }
}

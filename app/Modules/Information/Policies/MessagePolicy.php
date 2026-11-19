<?php

declare(strict_types=1);

namespace App\Modules\Information\Policies;

use App\Modules\Personnel\Models\User;

/**
 * Everyone writes to the office and reads the answers (`messages.use`). Only people with
 * `messages.office_inbox` open the shared inbox and answer. Nobody reads another person's
 * conversation except through the inbox.
 */
class MessagePolicy
{
    public function useOwn(User $user): bool
    {
        return $user->hasPermission('messages.use');
    }

    public function office(User $user): bool
    {
        return $user->hasPermission('messages.office_inbox');
    }
}

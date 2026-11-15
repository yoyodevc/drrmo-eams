<?php

declare(strict_types=1);

namespace App\Modules\Information\Policies;

use App\Modules\Information\Models\Memo;
use App\Modules\Personnel\Models\User;

/** Everyone reads memos (`memos.view`). Posting, editing and deleting need `memos.manage`. */
class MemoPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('memos.view') || $user->hasPermission('memos.manage');
    }

    public function view(User $user, Memo $memo): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('memos.manage');
    }

    public function update(User $user, Memo $memo): bool
    {
        return $user->hasPermission('memos.manage');
    }

    public function delete(User $user, Memo $memo): bool
    {
        return $user->hasPermission('memos.manage');
    }
}

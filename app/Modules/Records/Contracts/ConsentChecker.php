<?php

declare(strict_types=1);

namespace App\Modules\Records\Contracts;

use App\Modules\Personnel\Models\User;
use App\Modules\Records\Enums\ConsentPurpose;

interface ConsentChecker
{
    /**
     * True when the user has given consent for this purpose and has not withdrawn it.
     * For the privacy notice the consent must also be for the current notice version.
     */
    public function has(User $user, ConsentPurpose $purpose): bool;

    /** True when the user agreed to an older notice version and has not agreed to the current one yet. */
    public function outdated(User $user, ConsentPurpose $purpose): bool;
}

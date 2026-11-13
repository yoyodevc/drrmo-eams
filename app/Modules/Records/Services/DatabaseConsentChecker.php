<?php

declare(strict_types=1);

namespace App\Modules\Records\Services;

use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\ConsentChecker;
use App\Modules\Records\Enums\ConsentPurpose;
use App\Modules\Records\Models\ConsentRecord;

class DatabaseConsentChecker implements ConsentChecker
{
    public function has(User $user, ConsentPurpose $purpose): bool
    {
        $latest = $this->latest($user, $purpose);

        return $latest !== null
            && $latest->withdrawn_at === null
            && $this->isCurrent($latest, $purpose);
    }

    public function outdated(User $user, ConsentPurpose $purpose): bool
    {
        $latest = $this->latest($user, $purpose);

        return $latest !== null
            && $latest->withdrawn_at === null
            && ! $this->isCurrent($latest, $purpose);
    }

    private function latest(User $user, ConsentPurpose $purpose): ?ConsentRecord
    {
        return ConsentRecord::query()
            ->where('user_id', $user->getKey())
            ->where('purpose', $purpose->value)
            // Newest row by id. consented_at can disagree with the real order when clocks or time zones differ.
            ->latest('id')
            ->first();
    }

    /** Only the privacy notice is versioned. Changing its version asks everyone again. */
    private function isCurrent(ConsentRecord $record, ConsentPurpose $purpose): bool
    {
        return $purpose !== ConsentPurpose::PrivacyNotice
            || $record->notice_version === (string) config('privacy.notice_version');
    }
}

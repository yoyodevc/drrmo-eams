<?php

declare(strict_types=1);

namespace App\Modules\Records\Services;

use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\ConsentRecorder;
use App\Modules\Records\Enums\ConsentPurpose;
use App\Modules\Records\Models\ConsentRecord;

class DatabaseConsentRecorder implements ConsentRecorder
{
    public function give(User $user, ConsentPurpose $purpose, ?string $ipAddress = null): void
    {
        ConsentRecord::query()->create([
            'user_id' => $user->getKey(),
            'purpose' => $purpose,
            'notice_version' => (string) config('privacy.notice_version'),
            'consented_at' => now(),
            'ip_address' => $ipAddress,
        ]);
    }

    public function withdraw(User $user, ConsentPurpose $purpose): bool
    {
        return ConsentRecord::query()
            ->where('user_id', $user->getKey())
            ->where('purpose', $purpose->value)
            ->whereNull('withdrawn_at')
            ->update(['withdrawn_at' => now()]) > 0;
    }
}

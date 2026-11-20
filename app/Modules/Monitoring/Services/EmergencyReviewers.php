<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Services;

use App\Modules\Monitoring\Models\ReportReviewer;
use App\Modules\Personnel\Models\User;
use Illuminate\Support\Collection;

/**
 * The marshals who review every report and emergency, whatever the event. An admin picks them in the
 * settings screen (table report_reviewers). They hold `reports.view` for every event through the
 * Access permission checker, which asks this class.
 */
class EmergencyReviewers
{
    /** @return list<int> */
    public function ids(): array
    {
        return ReportReviewer::query()->pluck('user_id')->map(fn ($id) => (int) $id)->all();
    }

    public function includes(User $user): bool
    {
        return ReportReviewer::query()->where('user_id', $user->id)->exists();
    }

    /** @return Collection<int, User> Active reviewers only. */
    public function users(): Collection
    {
        return User::query()->whereIn('id', $this->ids())->where('account_status', 'active')->whereNull('disabled_at')->get();
    }
}

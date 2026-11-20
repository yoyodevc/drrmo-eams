<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Policies;

use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Models\Assignment;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Services\EmergencyReviewers;
use App\Modules\Personnel\Models\User;

/**
 * Sending is for a person who is on duty in their own assignment. Reviewing (the list, the location,
 * acknowledge, resolve) is for the global reviewer marshals and for holders of `reports.view`.
 */
class EmergencyReportPolicy
{
    public function __construct(private readonly EmergencyReviewers $reviewers) {}

    public function send(User $user, Assignment $assignment): bool
    {
        return $assignment->user_id === $user->id && $assignment->status === AssignmentStatus::OnDuty;
    }

    public function viewAny(User $user): bool
    {
        return $this->reviewers->includes($user) || $user->hasPermission('reports.view');
    }

    public function review(User $user, EmergencyReport $report): bool
    {
        return $this->viewAny($user);
    }

    /** The reporter may see the status and photo of their own report. */
    public function viewOwn(User $user, EmergencyReport $report): bool
    {
        return $report->user_id === $user->id;
    }
}

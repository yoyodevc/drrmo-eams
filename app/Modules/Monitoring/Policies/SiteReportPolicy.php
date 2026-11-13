<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Policies;

use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Models\User;

/**
 * Who may send and read site reports. Sending is for the person the slot belongs to, and only while
 * they hold `reports.submit` for that event. Reading follows `reports.view`: everywhere for a role
 * that holds it, or only for the events named in an event scoped grant.
 */
class SiteReportPolicy
{
    public function submit(User $user, SiteReport $report): bool
    {
        $report->loadMissing('assignment');

        return $report->assignment->user_id === $user->id
            && $user->hasPermission('reports.submit', $report->assignment->event_id);
    }

    public function view(User $user, SiteReport $report): bool
    {
        $report->loadMissing('assignment');

        return $user->hasPermission('reports.view', $report->assignment->event_id)
            || $user->hasPermission('reports.view');
    }

    /** True for anyone holding `reports.view` in any form (role or grant). */
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('reports.view') || $user->activeGrants()->get()->contains(
            fn ($g) => $g->permission->code === 'reports.view' && $g->permission->grantable,
        );
    }
}

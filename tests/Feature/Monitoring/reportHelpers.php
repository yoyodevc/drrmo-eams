<?php

declare(strict_types=1);

// Shared by the report tests. Loaded with require_once, and not itself a test file.

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Personnel\Models\User;
use Carbon\CarbonImmutable;

if (! function_exists('reportAssignment')) {
    /** A published event with one marshal assigned, shift from $start for $hours. */
    function reportAssignment(User $user, string $start = '2026-11-16 08:00:00', float $hours = 5, string $status = 'on_duty'): Assignment
    {
        $from = CarbonImmutable::parse($start);
        $event = Event::factory()->create(['status' => 'published', 'starts_at' => $from, 'ends_at' => $from->addMinutes((int) ($hours * 60))]);
        $req = $event->requirements()->create([
            'duty_type_id' => DutyType::query()->firstOrFail()->id, 'role' => 'marshal', 'headcount' => 1,
            'shift_starts_at' => $event->starts_at, 'shift_ends_at' => $event->ends_at,
        ]);

        return $req->assignments()->create(['event_id' => $event->id, 'user_id' => $user->id, 'duty_type_id' => $req->duty_type_id, 'status' => $status]);
    }
}

if (! function_exists('designate')) {
    /** Gives the person a permission for one event, the way an admin does with a grant. */
    function designate(User $user, int $eventId, array $over = [], string $permission = 'reports.submit'): PermissionGrant
    {
        return PermissionGrant::query()->create([
            'user_id' => $user->id, 'permission_id' => Permission::query()->where('code', $permission)->firstOrFail()->id, 'event_id' => $eventId,
            'starts_at' => now()->subDay(), 'ends_at' => now()->addDays(2), 'reason' => 'Site reporter', 'granted_by' => User::factory()->role(RoleCode::Admin)->create()->id, ...$over,
        ]);
    }
}

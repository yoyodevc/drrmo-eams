<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Monitoring\Services\ReportSchedule;
use App\Modules\Personnel\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    $this->travelTo(CarbonImmutable::parse('2026-11-16 08:00:00')); // a Monday
});

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

/** Makes the person a designated reporter for one event, the way an admin does with a grant. */
function designate(User $user, int $eventId, array $over = []): PermissionGrant
{
    return PermissionGrant::query()->create([
        'user_id' => $user->id, 'permission_id' => Permission::query()->where('code', 'reports.submit')->firstOrFail()->id, 'event_id' => $eventId,
        'starts_at' => now()->subDay(), 'ends_at' => now()->addDays(2), 'reason' => 'Site reporter', 'granted_by' => User::factory()->role(RoleCode::Admin)->create()->id, ...$over,
    ]);
}

it('works out due times: every 2 hours, or one slot at the end of a short shift', function () {
    $schedule = new ReportSchedule;
    $start = CarbonImmutable::parse('2026-11-16 08:00:00');

    expect(collect($schedule->dueTimes($start, $start->addHours(5)))->map->format('H:i')->all())->toBe(['10:00', '12:00'])
        ->and(collect($schedule->dueTimes($start, $start->addHours(2)))->map->format('H:i')->all())->toBe(['10:00'])
        ->and(collect($schedule->dueTimes($start, $start->addMinutes(90)))->map->format('H:i')->all())->toBe(['09:30'])
        ->and(collect($schedule->dueTimes($start, $start->addHours(6)))->map->format('H:i')->all())->toBe(['10:00', '12:00', '14:00']);
});

it('creates a slot for a designated reporter when one is about to fall due, and never twice', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = reportAssignment($user);
    designate($user, $assignment->event_id);

    // 08:00: the first slot is due at 10:00, too far away.
    Artisan::call('monitoring:create-report-slots');
    expect(SiteReport::query()->count())->toBe(0);

    // 09:50: due in 10 minutes, so it appears.
    $this->travelTo(CarbonImmutable::parse('2026-11-16 09:50:00'));
    Artisan::call('monitoring:create-report-slots');
    Artisan::call('monitoring:create-report-slots');
    $slot = SiteReport::query()->sole();
    expect($slot->assignment_id)->toBe($assignment->id)->and($slot->due_at->format('H:i'))->toBe('10:00')->and($slot->status->value)->toBe('pending');

    // 11:50: the second slot appears, the first stays as it was.
    $this->travelTo(CarbonImmutable::parse('2026-11-16 11:50:00'));
    Artisan::call('monitoring:create-report-slots');
    expect(SiteReport::query()->orderBy('due_at')->get()->map(fn ($r) => $r->due_at->format('H:i'))->all())->toBe(['10:00', '12:00']);
});

it('makes no slots for people who are not designated for that event', function () {
    $plain = User::factory()->role(RoleCode::Marshal)->create();
    $otherEvent = User::factory()->role(RoleCode::Marshal)->create();
    $revoked = User::factory()->role(RoleCode::Marshal)->create();
    $expired = User::factory()->role(RoleCode::Marshal)->create();
    $cancelled = User::factory()->role(RoleCode::Marshal)->create();

    reportAssignment($plain);
    reportAssignment($otherEvent);
    designate($otherEvent, Event::factory()->create()->id);
    designate($revoked, reportAssignment($revoked)->event_id, ['revoked_at' => now()->subHour()]);
    designate($expired, reportAssignment($expired)->event_id, ['ends_at' => now()->subMinute()]);
    $cancelledAssignment = reportAssignment($cancelled, status: 'cancelled');
    designate($cancelled, $cancelledAssignment->event_id);

    $this->travelTo(CarbonImmutable::parse('2026-11-16 09:55:00'));
    Artisan::call('monitoring:create-report-slots');

    expect(SiteReport::query()->count())->toBe(0);
});

it('makes nothing for a shift that is long over, and the database refuses a copy', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = reportAssignment($user, '2026-11-15 08:00:00', 3);
    designate($user, $assignment->event_id);

    Artisan::call('monitoring:create-report-slots');
    expect(SiteReport::query()->count())->toBe(0);

    $due = CarbonImmutable::parse('2026-11-16 10:00:00');
    SiteReport::query()->create(['assignment_id' => $assignment->id, 'due_at' => $due]);
    expect(fn () => SiteReport::query()->create(['assignment_id' => $assignment->id, 'due_at' => $due]))->toThrow(QueryException::class);
});

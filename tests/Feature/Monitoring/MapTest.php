<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Monitoring\Models\LocationPing;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;

// mapOnDuty() and point() come from PingTest.php.
beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    $this->travelTo(now()->startOfHour());
});

function mapOnDuty(User $user): Assignment
{
    $event = Event::factory()->create(['status' => 'published', 'starts_at' => now()->subMinutes(5), 'ends_at' => now()->addHours(4)]);
    $req = $event->requirements()->create([
        'duty_type_id' => DutyType::query()->firstOrFail()->id, 'role' => 'marshal', 'headcount' => 1,
        'shift_starts_at' => $event->starts_at, 'shift_ends_at' => $event->ends_at,
    ]);

    return $req->assignments()->create([
        'event_id' => $event->id, 'user_id' => $user->id, 'duty_type_id' => $req->duty_type_id,
        'status' => 'on_duty', 'duty_started_at' => now()->subMinutes(2),
    ]);
}

function pingAt(int $assignmentId, string $at, float $lat = 6.91): void
{
    LocationPing::query()->create(['assignment_id' => $assignmentId, 'latitude' => $lat, 'longitude' => 122.05, 'accuracy_m' => 10, 'captured_at' => now()->modify($at), 'received_at' => now()]);
}

it('shows the latest ping per on-duty person, with live, stale and no-location states', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $live = mapOnDuty(User::factory()->role(RoleCode::Marshal)->create());
    $stale = mapOnDuty(User::factory()->role(RoleCode::Marshal)->create());
    $none = mapOnDuty(User::factory()->role(RoleCode::Volunteer)->create());
    pingAt($live->id, '-2 minutes', 6.90);
    pingAt($live->id, '-30 seconds', 6.95);
    pingAt($stale->id, '-6 minutes');
    $ended = mapOnDuty(User::factory()->role(RoleCode::Marshal)->create());
    $ended->update(['status' => 'completed']);
    pingAt($ended->id, '-1 minute');

    $people = withAuthCookies(loginCookies($admin))->getJson('/api/map/latest')->assertOk()->json('data.people');
    $byId = collect($people)->keyBy('assignment_id');

    expect($people)->toHaveCount(3)
        ->and($byId[$live->id]['state'])->toBe('live')->and($byId[$live->id]['ping']['lat'])->toBe(6.95)
        ->and($byId[$stale->id]['state'])->toBe('stale')
        ->and($byId[$none->id]['state'])->toBe('none')->and($byId[$none->id]['ping'])->toBeNull()
        ->and($byId->has($ended->id))->toBeFalse();
});

it('filters by event and writes one audit row', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $a = mapOnDuty(User::factory()->role(RoleCode::Marshal)->create());
    mapOnDuty(User::factory()->role(RoleCode::Marshal)->create());

    withAuthCookies(loginCookies($admin))->getJson('/api/map/latest?event_id='.$a->event_id)->assertOk()->assertJsonCount(1, 'data.people');

    expect(AuditLog::query()->where('action', 'location.viewed')->where('actor_id', $admin->id)->count())->toBe(1);
});

it('draws the trail for one assignment in time order and audits once', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $a = mapOnDuty(User::factory()->role(RoleCode::Marshal)->create());
    $other = mapOnDuty(User::factory()->role(RoleCode::Marshal)->create());
    pingAt($a->id, '-1 minute', 6.93);
    pingAt($a->id, '-3 minutes', 6.91);
    pingAt($other->id, '-1 minute');

    $points = withAuthCookies(loginCookies($admin))->getJson("/api/map/trail/{$a->id}")->assertOk()->json('data.points');

    expect(array_column($points, 'lat'))->toBe([6.91, 6.93]);
    expect(AuditLog::query()->where('action', 'location.trail_viewed')->count())->toBe(1);
});

it('keeps location data away from everyone without location.view', function () {
    $a = mapOnDuty(User::factory()->role(RoleCode::Marshal)->create());
    pingAt($a->id, '-1 minute');

    foreach ([RoleCode::Marshal, RoleCode::Volunteer, RoleCode::Coordinator] as $role) {
        $cookies = loginCookies(User::factory()->role($role)->create());
        withAuthCookies($cookies)->getJson('/api/map/latest')->assertForbidden();
        withAuthCookies($cookies)->getJson("/api/map/trail/{$a->id}")->assertForbidden();
    }
    expect(AuditLog::query()->where('action', 'like', 'location.%')->count())->toBe(0);
});

it('requires login', function () {
    $this->getJson('/api/map/latest')->assertUnauthorized();
});

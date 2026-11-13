<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Monitoring\Console\PurgePings;
use App\Modules\Monitoring\Models\LocationPing;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Enums\ConsentPurpose;
use App\Modules\Records\Models\ConsentRecord;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    $this->travelTo(now()->startOfHour());
});

function onDuty(User $user): Assignment
{
    ConsentRecord::query()->create(['user_id' => $user->id, 'purpose' => ConsentPurpose::LocationTracking, 'notice_version' => 'v1', 'consented_at' => now()]);
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

/** @return array{lat: float, lng: float, accuracy_m: int, captured_at: string} */
function point(string $at = 'now'): array
{
    return ['lat' => 6.91212, 'lng' => 122.05909, 'accuracy_m' => 12, 'captured_at' => now()->modify($at)->toIso8601String()];
}

it('stores a batch of points for the owner while on duty', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = onDuty($user);

    withAuthCookies(loginCookies($user))
        ->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point('-30 seconds'), point()]])
        ->assertOk()->assertJsonPath('data.accepted', 2)->assertJsonPath('data.rejected', 0);

    expect(LocationPing::query()->where('assignment_id', $assignment->id)->count())->toBe(2);
});

it('forbids pings on someone else\'s assignment and for roles without location.send_own', function () {
    $owner = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = onDuty($owner);
    $other = User::factory()->role(RoleCode::Marshal)->create();
    $admin = User::factory()->role(RoleCode::Admin)->create();

    withAuthCookies(loginCookies($other))->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point()]])->assertForbidden();
    withAuthCookies(loginCookies($admin))->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point()]])->assertForbidden();
    expect(LocationPing::query()->count())->toBe(0);
});

it('requires login', function () {
    $assignment = onDuty(User::factory()->role(RoleCode::Marshal)->create());
    $this->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point()]])->assertUnauthorized();
});

it('rejects points outside the duty window and keeps the good ones', function () {
    $user = User::factory()->role(RoleCode::Volunteer)->create();
    $assignment = onDuty($user);
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point('-1 hour'), point('+1 hour'), point()]])
        ->assertOk()->assertJsonPath('data.accepted', 1)->assertJsonPath('data.rejected', 2);

    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point('-1 hour')]])->assertUnprocessable();
});

it('refuses pings when duty never started, after consent withdrawal, or with bad input', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = onDuty($user);
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => []])->assertUnprocessable();
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => array_fill(0, 51, point())])->assertUnprocessable();
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [['lat' => 95, 'lng' => 0, 'captured_at' => now()->toIso8601String()]]])->assertUnprocessable();

    $assignment->update(['status' => 'assigned', 'duty_started_at' => null]);
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point()]])->assertUnprocessable();

    $assignment->update(['status' => 'on_duty', 'duty_started_at' => now()->subMinutes(2)]);
    ConsentRecord::query()->where('user_id', $user->id)->update(['withdrawn_at' => now()]);
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point()]])->assertUnprocessable();
});

it('accepts queued points after duty ended, within the duty window', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = onDuty($user);
    $assignment->update(['status' => 'completed', 'duty_ended_at' => now()->subMinute()]);

    withAuthCookies(loginCookies($user))->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point('-90 seconds'), point('+10 minutes')]])
        ->assertOk()->assertJsonPath('data.accepted', 1)->assertJsonPath('data.rejected', 1);
});

it('limits uploads to 10 a minute per user', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = onDuty($user);
    $cookies = loginCookies($user);

    foreach (range(1, 10) as $i) {
        withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point()]])->assertOk();
    }
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/pings", ['points' => [point()]])->assertStatus(429);
});

it('counts the retention cutoff in working days, skipping weekends', function () {
    // Friday 2026-11-13: ten working days back is Friday 2026-10-30.
    expect(PurgePings::cutoff(CarbonImmutable::parse('2026-11-13 02:00'))->toDateString())->toBe('2026-10-30')
        // Monday 2026-11-09: ten working days back is Monday 2026-10-26.
        ->and(PurgePings::cutoff(CarbonImmutable::parse('2026-11-09 02:00'))->toDateString())->toBe('2026-10-26')
        // Saturday: Friday 13th is the first working day back, so ten reaches Monday 2026-11-02.
        ->and(PurgePings::cutoff(CarbonImmutable::parse('2026-11-14 02:00'))->toDateString())->toBe('2026-11-02');
});

it('purges only pings older than the cutoff, in chunks', function () {
    $assignment = onDuty(User::factory()->role(RoleCode::Marshal)->create());
    $this->travelTo(CarbonImmutable::parse('2026-11-13 02:00'));
    $make = fn (string $at) => LocationPing::query()->create(['assignment_id' => $assignment->id, 'latitude' => 6.9, 'longitude' => 122.0, 'captured_at' => $at, 'received_at' => $at]);
    $old = $make('2026-10-29 23:59:00');
    $edge = $make('2026-10-30 00:00:00');
    $new = $make('2026-11-12 10:00:00');

    Artisan::call('monitoring:purge-pings');

    expect(LocationPing::query()->pluck('id')->all())->toEqualCanonicalizing([$edge->id, $new->id])
        ->and(LocationPing::query()->whereKey($old->id)->exists())->toBeFalse();
});

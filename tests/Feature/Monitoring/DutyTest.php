<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Enums\ConsentPurpose;
use App\Modules\Records\Models\AuditLog;
use App\Modules\Records\Models\ConsentRecord;
use Illuminate\Support\Facades\Artisan;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    $this->travelTo(now()->startOfHour());
});

function dutyFor(User $user, string $startsIn = '+10 minutes', string $length = '+4 hours', array $over = []): Assignment
{
    $event = Event::factory()->create(['status' => 'published', 'starts_at' => now()->modify($startsIn), 'ends_at' => now()->modify($length)]);
    $req = $event->requirements()->create([
        'duty_type_id' => DutyType::query()->firstOrFail()->id, 'role' => 'marshal', 'headcount' => 1,
        'shift_starts_at' => $event->starts_at, 'shift_ends_at' => $event->ends_at,
    ]);

    return $req->assignments()->create(['event_id' => $event->id, 'user_id' => $user->id, 'duty_type_id' => $req->duty_type_id, ...$over]);
}

function consented(User $user): User
{
    ConsentRecord::query()->create(['user_id' => $user->id, 'purpose' => ConsentPurpose::LocationTracking, 'notice_version' => 'v1', 'consented_at' => now()]);

    return $user;
}

it('starts and ends duty, setting times and auditing both', function () {
    $user = consented(User::factory()->role(RoleCode::Marshal)->create());
    $assignment = dutyFor($user);
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/start-duty")->assertOk()->assertJsonPath('data.status', 'on_duty');
    expect($assignment->fresh()->duty_started_at)->not->toBeNull();

    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/end-duty")->assertOk()->assertJsonPath('data.status', 'completed');
    expect($assignment->fresh()->duty_ended_at)->not->toBeNull()
        ->and(AuditLog::query()->whereIn('action', ['assignment.duty_started', 'assignment.duty_ended'])->count())->toBe(2);
});

it('refuses start more than 15 minutes early, after the shift, or twice', function () {
    $user = consented(User::factory()->role(RoleCode::Volunteer)->create());
    $early = dutyFor($user, '+16 minutes');
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->postJson("/api/me/assignments/{$early->id}/start-duty")->assertUnprocessable();

    $this->travelTo(now()->addMinutes(2));
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$early->id}/start-duty")->assertOk();
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$early->id}/start-duty")->assertUnprocessable();

    $over = dutyFor($user, '-5 hours', '-1 hour');
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$over->id}/start-duty")->assertUnprocessable();
});

it('needs location consent and active status', function () {
    $noConsent = User::factory()->role(RoleCode::Marshal)->create();
    $a = dutyFor($noConsent);
    withAuthCookies(loginCookies($noConsent))->postJson("/api/me/assignments/{$a->id}/start-duty")->assertUnprocessable();

    $inactive = consented(User::factory()->role(RoleCode::Marshal)->create(['status' => 'inactive']));
    $b = dutyFor($inactive);
    withAuthCookies(loginCookies($inactive))->postJson("/api/me/assignments/{$b->id}/start-duty")->assertUnprocessable();
});

it('keeps start and end away from other people and ending when not on duty', function () {
    $mine = consented(User::factory()->role(RoleCode::Marshal)->create());
    $other = consented(User::factory()->role(RoleCode::Marshal)->create());
    $assignment = dutyFor($mine);

    withAuthCookies(loginCookies($other))->postJson("/api/me/assignments/{$assignment->id}/start-duty")->assertForbidden();
    withAuthCookies(loginCookies($other))->postJson("/api/me/assignments/{$assignment->id}/end-duty")->assertForbidden();
    withAuthCookies(loginCookies($mine))->postJson("/api/me/assignments/{$assignment->id}/end-duty")->assertUnprocessable();
});

it('auto ends open duties 30 minutes after the shift end', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $due = dutyFor($user, '-5 hours', '-31 minutes', ['status' => 'on_duty']);
    $notYet = dutyFor(User::factory()->role(RoleCode::Marshal)->create(), '-5 hours', '-10 minutes', ['status' => 'on_duty']);

    Artisan::call('monitoring:auto-end-duty');

    expect($due->fresh()->status->value)->toBe('completed')->and($due->fresh()->duty_ended_at)->not->toBeNull()
        ->and($notYet->fresh()->status->value)->toBe('on_duty')
        ->and(AuditLog::query()->where('action', 'assignment.duty_ended')->firstOrFail()->meta['source'])->toBe('system');
});

it('lets a person agree again after withdrawing and start duty right away', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = dutyFor($user);
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->postJson('/api/consent/location')->assertNoContent();
    withAuthCookies($cookies)->deleteJson('/api/consent/location')->assertNoContent();
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/start-duty")->assertUnprocessable()
        ->assertJsonPath('message', 'Location consent is needed to start duty.');

    withAuthCookies($cookies)->postJson('/api/consent/location')->assertNoContent();
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/start-duty")->assertOk()->assertJsonPath('data.status', 'on_duty');
});

it('is not fooled by a withdrawn consent row dated in the future', function () {
    // Real case: an old row got a consented_at hours ahead of the clock, so it always looked "latest"
    // and every new agree was ignored, which made Start duty fail with 422 after Agree.
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = dutyFor($user);
    ConsentRecord::query()->create(['user_id' => $user->id, 'purpose' => ConsentPurpose::LocationTracking, 'notice_version' => 'v1', 'consented_at' => now()->addHours(8), 'withdrawn_at' => now()]);
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->postJson('/api/consent/location')->assertNoContent();
    withAuthCookies($cookies)->postJson('/api/consent/location')->assertNoContent();

    expect(ConsentRecord::query()->where('user_id', $user->id)->where('purpose', ConsentPurpose::LocationTracking->value)->count())->toBe(2);
    withAuthCookies($cookies)->postJson("/api/me/assignments/{$assignment->id}/start-duty")->assertOk();
});

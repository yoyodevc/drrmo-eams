<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Personnel\Enums\AvailabilityStatus;
use App\Modules\Personnel\Models\User;
use App\Modules\Personnel\Models\VolunteerStatusLog;
use App\Modules\Records\Models\AuditLog;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
});

it('switches a volunteer inactive with a reason, writes history and audits it', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();

    withAuthCookies(loginCookies($admin))->putJson("/api/admin/volunteers/{$volunteer->id}/status", ['status' => 'inactive', 'reason' => 'On leave this month'])
        ->assertOk()->assertJsonPath('data.status', 'inactive');

    expect($volunteer->refresh()->status)->toBe(AvailabilityStatus::Inactive);
    $log = VolunteerStatusLog::query()->where('user_id', $volunteer->id)->sole();
    expect($log->old_status)->toBe(AvailabilityStatus::Active)
        ->and($log->new_status)->toBe(AvailabilityStatus::Inactive)
        ->and($log->reason)->toBe('On leave this month')
        ->and($log->changed_by)->toBe($admin->id);
    expect(AuditLog::query()->where('action', 'volunteer.status_changed')->exists())->toBeTrue();

    withAuthCookies(loginCookies($admin))->getJson("/api/admin/volunteers/{$volunteer->id}/status-history")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.reason', 'On leave this month');
});

it('needs a reason and a real change', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();

    withAuthCookies(loginCookies($admin))->putJson("/api/admin/volunteers/{$volunteer->id}/status", ['status' => 'inactive'])
        ->assertUnprocessable()->assertJsonValidationErrors('reason');
    withAuthCookies(loginCookies($admin))->putJson("/api/admin/volunteers/{$volunteer->id}/status", ['status' => 'active', 'reason' => 'Already fine'])
        ->assertUnprocessable();
    expect(VolunteerStatusLog::query()->count())->toBe(0);
});

it('lists volunteers and filters by status', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    User::factory()->role(RoleCode::Volunteer)->create();
    User::factory()->role(RoleCode::Volunteer)->inactive()->create();
    User::factory()->role(RoleCode::Marshal)->create();

    withAuthCookies(loginCookies($admin))->getJson('/api/admin/volunteers')->assertOk()->assertJsonCount(2, 'data');
    withAuthCookies(loginCookies($admin))->getJson('/api/admin/volunteers?status=inactive')->assertOk()->assertJsonCount(1, 'data');
    withAuthCookies(loginCookies($admin))->getJson('/api/admin/volunteers?status=nonsense')->assertUnprocessable();
});

it('keeps non-admins out', function () {
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();
    $other = User::factory()->role(RoleCode::Volunteer)->create();

    withAuthCookies(loginCookies($volunteer))->getJson('/api/admin/volunteers')->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->putJson("/api/admin/volunteers/{$other->id}/status", ['status' => 'inactive', 'reason' => 'Nope nope'])->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->getJson("/api/admin/volunteers/{$other->id}/status-history")->assertForbidden();
    expect($other->refresh()->status)->toBe(AvailabilityStatus::Active);
});

it('does not offer or assign an inactive volunteer', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $gone = User::factory()->role(RoleCode::Volunteer)->inactive()->create();
    $event = Event::factory()->create();
    $req = $event->requirements()->create([
        'duty_type_id' => DutyType::query()->firstOrFail()->id,
        'role' => 'volunteer',
        'headcount' => 1,
        'shift_starts_at' => $event->starts_at,
        'shift_ends_at' => $event->ends_at,
    ]);

    withAuthCookies(loginCookies($admin))->getJson("/api/requirements/{$req->id}/candidates")
        ->assertOk()->assertJsonMissing(['id' => $gone->id]);
    withAuthCookies(loginCookies($admin))->postJson("/api/requirements/{$req->id}/assignments", ['user_id' => $gone->id])
        ->assertUnprocessable();
});

it('lets a person read only their own availability and history', function () {
    $mine = User::factory()->role(RoleCode::Volunteer)->inactive()->create();
    $other = User::factory()->role(RoleCode::Volunteer)->create();
    VolunteerStatusLog::query()->create(['user_id' => $mine->id, 'old_status' => 'active', 'new_status' => 'inactive', 'reason' => 'On leave', 'changed_by' => null]);
    VolunteerStatusLog::query()->create(['user_id' => $other->id, 'old_status' => 'inactive', 'new_status' => 'active', 'reason' => 'Back', 'changed_by' => null]);

    withAuthCookies(loginCookies($mine))->getJson('/api/me/availability')
        ->assertOk()->assertJsonPath('data.status', 'inactive')
        ->assertJsonCount(1, 'data.history')->assertJsonPath('data.history.0.reason', 'On leave');
    test()->withHeaders([])->getJson('/api/me/availability')->assertUnauthorized();
});

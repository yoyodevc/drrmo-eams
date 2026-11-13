<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Enums\ConsentPurpose;
use App\Modules\Records\Models\AuditLog;
use App\Modules\Records\Models\ConsentRecord;
use Database\Seeders\PermissionSeeder;

beforeEach(function () {
    $this->seed(PermissionSeeder::class);
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
});

function locationRows(User $user): int
{
    return ConsentRecord::query()->where('user_id', $user->id)->where('purpose', ConsentPurpose::LocationTracking->value)->count();
}

it('records location consent with version, time and IP, and audits it', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();

    $this->actingAs($user)->postJson('/api/consent/location')->assertNoContent();

    $row = ConsentRecord::query()->where('user_id', $user->id)->where('purpose', ConsentPurpose::LocationTracking->value)->sole();
    expect($row->notice_version)->toBe(config('privacy.notice_version'))->and($row->ip_address)->not->toBeNull();
    expect(AuditLog::query()->where('action', 'consent.given')->where('actor_id', $user->id)->count())->toBeGreaterThan(0);
    $this->getJson('/api/me')->assertJsonPath('data.consent.location_tracking', true);
});

it('does not write a second row when they agree twice', function () {
    $user = User::factory()->role(RoleCode::Volunteer)->create();

    $this->actingAs($user)->postJson('/api/consent/location')->assertNoContent();
    $this->postJson('/api/consent/location')->assertNoContent();

    expect(locationRows($user))->toBe(1);
});

it('refuses people who never share location', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $this->actingAs($admin)->postJson('/api/consent/location')->assertForbidden();
    expect(locationRows($admin))->toBe(0);
});

it('needs a sign in', function () {
    $this->postJson('/api/consent/location')->assertUnauthorized();
    $this->deleteJson('/api/consent/location')->assertUnauthorized();
});

it('withdraws consent, audits it, and leaves other people alone', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $other = User::factory()->role(RoleCode::Marshal)->create();
    $this->actingAs($user)->postJson('/api/consent/location')->assertNoContent();
    $this->actingAs($other)->postJson('/api/consent/location')->assertNoContent();

    $this->actingAs($user)->deleteJson('/api/consent/location')->assertNoContent();

    $this->getJson('/api/me')->assertJsonPath('data.consent.location_tracking', false);
    expect(AuditLog::query()->where('action', 'consent.withdrawn')->where('actor_id', $user->id)->exists())->toBeTrue();
    $this->actingAs($other)->getJson('/api/me')->assertJsonPath('data.consent.location_tracking', true);
});

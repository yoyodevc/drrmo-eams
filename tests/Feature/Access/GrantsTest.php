<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Events\Models\Event;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Tests\Support\FakeMailSender;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    app()->instance(MailSender::class, new FakeMailSender);
});

/** @param  array<string, mixed>  $over */
function newGrant(User $person, array $over = []): array
{
    return [
        'user_id' => $person->id, 'permission' => 'reports.view',
        'starts_at' => now()->toIso8601String(), 'ends_at' => now()->addDay()->toIso8601String(),
        'reason' => 'Covering the foundation day desk', ...$over,
    ];
}

function adminCookies(): array
{
    return loginCookies(User::factory()->role(RoleCode::Admin)->create());
}

it('lets an admin give a grant, audits it and the person gains the permission', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();

    $id = withAuthCookies(adminCookies())->postJson('/api/grants', newGrant($marshal))
        ->assertCreated()->assertJsonPath('data.status', 'active')->assertJsonPath('data.permission.code', 'reports.view')
        ->assertJsonPath('data.person.id', $marshal->id)->json('data.id');

    $log = AuditLog::query()->where('action', 'grant.created')->firstOrFail();
    expect($log->entity_id)->toBe($id)->and($log->meta['reason'])->toBe('Covering the foundation day desk');

    withAuthCookies(loginCookies($marshal))->getJson('/api/me')
        ->assertOk()->assertJsonPath('permissions', fn ($p) => in_array('reports.view', $p, true))
        ->assertJsonCount(1, 'grants');
});

it('refuses everyone but an admin on every grant endpoint', function (RoleCode $role) {
    $user = User::factory()->role($role)->create();
    $target = User::factory()->role(RoleCode::Volunteer)->create();
    $grant = PermissionGrant::query()->create([
        'user_id' => $target->id, 'permission_id' => Permission::query()->where('code', 'reports.view')->value('id'),
        'starts_at' => now()->subHour(), 'ends_at' => now()->addHour(), 'reason' => 'Test reason',
    ]);
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->getJson('/api/grants')->assertForbidden();
    withAuthCookies($cookies)->postJson('/api/grants', newGrant($target))->assertForbidden();
    withAuthCookies($cookies)->postJson("/api/grants/{$grant->id}/revoke")->assertForbidden();
    expect($grant->fresh()->revoked_at)->toBeNull();
})->with([RoleCode::Marshal, RoleCode::Volunteer, RoleCode::Coordinator]);

it('does not let a person grant themselves anything through a holding grant', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    PermissionGrant::query()->create([
        'user_id' => $marshal->id, 'permission_id' => Permission::query()->where('code', 'reports.view')->value('id'),
        'starts_at' => now()->subHour(), 'ends_at' => now()->addHour(), 'reason' => 'Test reason',
    ]);

    withAuthCookies(loginCookies($marshal))->postJson('/api/grants', newGrant($marshal, ['permission' => 'location.view']))->assertForbidden();
});

it('requires an event for reports.submit', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $cookies = adminCookies();

    withAuthCookies($cookies)->postJson('/api/grants', newGrant($marshal, ['permission' => 'reports.submit']))
        ->assertUnprocessable()->assertJsonValidationErrors('event_id');

    $event = Event::factory()->create();
    withAuthCookies($cookies)->postJson('/api/grants', newGrant($marshal, ['permission' => 'reports.submit', 'event_id' => $event->id]))
        ->assertCreated()->assertJsonPath('data.event.id', $event->id);
});

it('limits location.view to 7 days', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $cookies = adminCookies();

    withAuthCookies($cookies)->postJson('/api/grants', newGrant($marshal, ['permission' => 'location.view', 'ends_at' => now()->addDays(8)->toIso8601String()]))
        ->assertUnprocessable()->assertJsonValidationErrors('ends_at');
    withAuthCookies($cookies)->postJson('/api/grants', newGrant($marshal, ['permission' => 'location.view', 'ends_at' => now()->addDays(7)->subMinute()->toIso8601String()]))
        ->assertCreated();
});

it('rejects bad input', function (string $case) {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    [$over, $field] = match ($case) {
        'no reason' => [['reason' => ''], 'reason'],
        'end before start' => [['ends_at' => now()->subHour()->toIso8601String()], 'ends_at'],
        'permission from role only' => [['permission' => 'access.manage'], 'permission'],
        'unknown permission' => [['permission' => 'nope.nope'], 'permission'],
        'start in the past' => [['starts_at' => now()->subDay()->toIso8601String()], 'starts_at'],
    };

    withAuthCookies(adminCookies())->postJson('/api/grants', newGrant($marshal, $over))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with(['no reason', 'end before start', 'permission from role only', 'unknown permission', 'start in the past']);

it('rejects a permission the role already holds and an account that cannot sign in', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $disabled = User::factory()->role(RoleCode::Marshal)->disabled()->create();
    $cookies = adminCookies();

    withAuthCookies($cookies)->postJson('/api/grants', newGrant($admin))->assertUnprocessable()->assertJsonValidationErrors('permission');
    withAuthCookies($cookies)->postJson('/api/grants', newGrant($disabled))->assertUnprocessable()->assertJsonValidationErrors('user_id');
});

it('rejects an overlapping grant for the same permission', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $cookies = adminCookies();

    withAuthCookies($cookies)->postJson('/api/grants', newGrant($marshal))->assertCreated();
    withAuthCookies($cookies)->postJson('/api/grants', newGrant($marshal))->assertUnprocessable()->assertJsonValidationErrors('permission');
});

it('revokes a grant, audits it and the access ends at once', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $cookies = adminCookies();
    $id = withAuthCookies($cookies)->postJson('/api/grants', newGrant($marshal))->json('data.id');

    withAuthCookies($cookies)->postJson("/api/grants/{$id}/revoke")->assertOk()
        ->assertJsonPath('data.status', 'revoked')->assertJsonPath('data.revoked_by', fn ($n) => $n !== null);

    $grant = PermissionGrant::query()->findOrFail($id);
    expect($grant->revoked_at)->not->toBeNull()->and($grant->revoked_by)->not->toBeNull();
    expect(AuditLog::query()->where('action', 'grant.revoked')->where('entity_id', $id)->exists())->toBeTrue();
    expect($marshal->fresh()->hasPermission('reports.view'))->toBeFalse();

    withAuthCookies($cookies)->postJson("/api/grants/{$id}/revoke")->assertUnprocessable();
});

it('lists grants with filters', function () {
    $a = User::factory()->role(RoleCode::Marshal)->create();
    $b = User::factory()->role(RoleCode::Volunteer)->create();
    $cookies = adminCookies();
    withAuthCookies($cookies)->postJson('/api/grants', newGrant($a))->assertCreated();
    $old = withAuthCookies($cookies)->postJson('/api/grants', newGrant($b))->json('data.id');
    withAuthCookies($cookies)->postJson("/api/grants/{$old}/revoke")->assertOk();

    withAuthCookies($cookies)->getJson('/api/grants')->assertOk()->assertJsonCount(2, 'data');
    withAuthCookies($cookies)->getJson("/api/grants?user={$a->id}")->assertOk()->assertJsonCount(1, 'data');
    withAuthCookies($cookies)->getJson('/api/grants?active=1')->assertOk()->assertJsonCount(1, 'data');
});

it('shows a person only their own grants on /me/grants', function () {
    $mine = User::factory()->role(RoleCode::Marshal)->create();
    $theirs = User::factory()->role(RoleCode::Marshal)->create();
    $cookies = adminCookies();
    withAuthCookies($cookies)->postJson('/api/grants', newGrant($mine))->assertCreated();
    withAuthCookies($cookies)->postJson('/api/grants', newGrant($theirs, ['permission' => 'location.view']))->assertCreated();

    withAuthCookies(loginCookies($mine))->getJson('/api/me/grants')->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.permission.code', 'reports.view');
});

it('leaves event scoped grants out of /me permissions but lists them under grants', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create(['title' => 'Foundation Day']);
    withAuthCookies(adminCookies())->postJson('/api/grants', newGrant($marshal, ['permission' => 'reports.submit', 'event_id' => $event->id]))->assertCreated();

    $me = withAuthCookies(loginCookies($marshal))->getJson('/api/me')->assertOk();
    expect($me->json('permissions'))->not->toContain('reports.submit');
    $me->assertJsonPath('grants.0.permission', 'reports.submit')->assertJsonPath('grants.0.event_title', 'Foundation Day');
});

it('lets a granted person use an admin screen only while the grant lasts', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $cookies = loginCookies($marshal);

    withAuthCookies($cookies)->getJson('/api/people')->assertForbidden();

    $id = withAuthCookies(adminCookies())->postJson('/api/grants', newGrant($marshal, ['permission' => 'people.view']))->assertCreated()->json('data.id');
    withAuthCookies($cookies)->getJson('/api/people')->assertOk();
    // Viewing is not managing.
    withAuthCookies($cookies)->postJson('/api/people', ['first_name' => 'A', 'last_name' => 'B', 'email' => 'ab@example.test', 'role' => 'volunteer'])->assertForbidden();

    PermissionGrant::query()->whereKey($id)->update(['revoked_at' => now()]);
    withAuthCookies($cookies)->getJson('/api/people')->assertForbidden();
});

it('does not let a person who only holds people.manage by grant create or change an admin', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    withAuthCookies(adminCookies())->postJson('/api/grants', newGrant($marshal, ['permission' => 'people.manage']))->assertCreated();
    $cookies = loginCookies($marshal);
    $person = ['first_name' => 'Ana', 'last_name' => 'Reyes', 'email' => 'ana@example.test', 'role' => 'volunteer'];

    withAuthCookies($cookies)->postJson('/api/people', $person)->assertCreated();
    withAuthCookies($cookies)->postJson('/api/people', [...$person, 'email' => 'boss@example.test', 'role' => 'admin'])->assertForbidden();
    withAuthCookies($cookies)->patchJson("/api/people/{$admin->id}", [
        'first_name' => $admin->first_name, 'last_name' => $admin->last_name, 'email' => $admin->email, 'role' => 'volunteer',
    ])->assertForbidden();
    withAuthCookies($cookies)->patchJson("/api/people/{$marshal->id}", [
        'first_name' => $marshal->first_name, 'last_name' => $marshal->last_name, 'email' => $marshal->email, 'role' => 'admin',
    ])->assertForbidden();
});

it('lists the grantable permissions for admins only', function () {
    $codes = withAuthCookies(adminCookies())->getJson('/api/grantable-permissions')->assertOk()->json('data.*.code');

    expect($codes)->toContain('people.view', 'events.manage', 'reports.submit')->not->toContain('access.manage', 'profile.own');
    withAuthCookies(loginCookies(User::factory()->role(RoleCode::Marshal)->create()))->getJson('/api/grantable-permissions')->assertForbidden();
});

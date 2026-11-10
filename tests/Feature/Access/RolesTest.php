<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Access\Models\Role;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Database\Seeders\PermissionSeeder;
use Tests\Support\FakeMailSender;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    app()->instance(MailSender::class, new FakeMailSender);
});

function roleId(string $code): int
{
    return (int) Role::query()->where('code', $code)->value('id');
}

/** @return list<string> */
function codesOf(string $role): array
{
    return Role::query()->where('code', $role)->firstOrFail()->permissions()->pluck('code')->sort()->values()->all();
}

/** @param  list<string>  $codes */
function customRole(string $name, array $codes): Role
{
    $role = Role::query()->create(['code' => str_replace(' ', '_', strtolower($name)), 'name' => $name, 'is_system' => false]);
    $role->permissions()->sync(Permission::query()->whereIn('code', [...$codes, 'memos.view', 'messages.use', 'profile.own'])->pluck('id'));

    return $role;
}

function adminSession(): array
{
    return loginCookies(User::factory()->role(RoleCode::Admin)->create());
}

it('lists every role with its people, permissions and locked cells', function () {
    User::factory()->role(RoleCode::Marshal)->count(2)->create();

    $roles = withAuthCookies(adminSession())->getJson('/api/roles')->assertOk()->json('data');

    expect(array_column($roles, 'code'))->toBe(['admin', 'marshal', 'volunteer', 'coordinator']);
    $marshal = collect($roles)->firstWhere('code', 'marshal');
    expect($marshal['members_count'])->toBe(2)
        ->and($marshal['is_field'])->toBeTrue()
        ->and($marshal['can_delete'])->toBeFalse()
        ->and($marshal['locks']['assignments.own']['on'])->toBeTrue()
        ->and($marshal['locks']['location.view']['on'])->toBeFalse()
        ->and($marshal['locks'])->not->toHaveKey('reports.view');
});

it('keeps every role endpoint to admins', function (RoleCode $code) {
    $cookies = loginCookies(User::factory()->role($code)->create());
    $id = roleId('coordinator');

    withAuthCookies($cookies)->getJson('/api/roles')->assertForbidden();
    withAuthCookies($cookies)->getJson('/api/permissions')->assertForbidden();
    withAuthCookies($cookies)->getJson("/api/roles/{$id}")->assertForbidden();
    withAuthCookies($cookies)->postJson('/api/roles', ['name' => 'Sneaky role'])->assertForbidden();
    withAuthCookies($cookies)->patchJson("/api/roles/{$id}", ['name' => 'Renamed'])->assertForbidden();
    withAuthCookies($cookies)->deleteJson("/api/roles/{$id}")->assertForbidden();
    withAuthCookies($cookies)->putJson('/api/roles/permissions', ['roles' => [['id' => $id, 'permissions' => []]]])->assertForbidden();
    withAuthCookies($cookies)->postJson("/api/roles/{$id}/members", ['user_ids' => [1]])->assertForbidden();
    withAuthCookies($cookies)->getJson('/api/role-options')->assertForbidden();
})->with([RoleCode::Marshal, RoleCode::Volunteer, RoleCode::Coordinator]);

it('does not let a grant of people.manage open the role screens', function () {
    $coordinator = User::factory()->role(RoleCode::Coordinator)->create();
    PermissionGrant::query()->create([
        'user_id' => $coordinator->id, 'permission_id' => Permission::query()->where('code', 'people.manage')->value('id'),
        'starts_at' => now()->subHour(), 'ends_at' => now()->addDay(), 'reason' => 'Test reason',
    ]);

    withAuthCookies(loginCookies($coordinator))->getJson('/api/roles')->assertForbidden();
    withAuthCookies(loginCookies($coordinator))->getJson('/api/role-options')->assertOk();
});

it('creates a custom role from a copy, without the duty or admin-only cells, and audits it', function () {
    $id = withAuthCookies(adminSession())->postJson('/api/roles', [
        'name' => '  Records   officer ', 'description' => 'Keeps the audit trail', 'copy_from' => roleId('marshal'),
    ])->assertCreated()->assertJsonPath('data.name', 'Records officer')->assertJsonPath('data.is_system', false)
        ->json('data.id');

    $role = Role::query()->findOrFail($id);
    expect($role->code)->toBe('records_officer')
        ->and(codesOf('records_officer'))->toBe(['memos.view', 'messages.use', 'profile.own']);
    expect(AuditLog::query()->where('action', 'role.created')->where('entity_id', $id)->exists())->toBeTrue();

    withAuthCookies(adminSession())->postJson('/api/roles', ['name' => 'records officer'])
        ->assertUnprocessable()->assertJsonValidationErrors('name');
});

it('never reuses a built-in code for a custom role', function () {
    withAuthCookies(adminSession())->postJson('/api/roles', ['name' => 'Admin'])->assertUnprocessable();
    $id = withAuthCookies(adminSession())->postJson('/api/roles', ['name' => 'ADMIN!'])->json('data.id');

    expect(Role::query()->findOrFail($id)->code)->toBe('role_admin');
});

it('saves role permissions from the matrix and the role gains them at once', function () {
    $coordinator = User::factory()->role(RoleCode::Coordinator)->create();
    $codes = [...codesOf('coordinator'), 'reports.view', 'audit.view'];

    withAuthCookies(adminSession())->putJson('/api/roles/permissions', ['roles' => [
        ['id' => roleId('coordinator'), 'permissions' => $codes],
        ['id' => roleId('volunteer'), 'permissions' => codesOf('volunteer')],
    ]])->assertOk();

    expect(codesOf('coordinator'))->toContain('reports.view', 'audit.view');
    $log = AuditLog::query()->where('action', 'role.permissions_changed')->sole();
    expect($log->meta['added'])->toBe(['reports.view', 'audit.view'])->and($log->meta['removed'])->toBe([]);

    withAuthCookies(loginCookies($coordinator))->getJson('/api/me')->assertOk()
        ->assertJsonPath('permissions', fn ($p) => in_array('audit.view', $p, true));
});

it('rejects a change to a locked cell and saves nothing', function (string $role, array $change) {
    $before = codesOf('coordinator');
    $codes = array_values(array_diff([...codesOf($role), ...$change['add']], $change['remove']));

    withAuthCookies(adminSession())->putJson('/api/roles/permissions', ['roles' => [
        ['id' => roleId('coordinator'), 'permissions' => [...$before, 'reports.view']],
        ['id' => roleId($role), 'permissions' => $codes],
    ]])->assertUnprocessable()->assertJsonValidationErrors('roles.1.permissions');

    expect(codesOf('coordinator'))->toBe($before);
})->with([
    'map to a non admin' => ['marshal', ['add' => ['location.view'], 'remove' => []]],
    'access.manage to a non admin' => ['volunteer', ['add' => ['access.manage'], 'remove' => []]],
    'anything off the admin' => ['admin', ['add' => [], 'remove' => ['audit.view']]],
    'the basics off a role' => ['volunteer', ['add' => [], 'remove' => ['profile.own']]],
    'duty off a field role' => ['marshal', ['add' => [], 'remove' => ['assignments.own']]],
    'duty to the coordinator' => ['coordinator', ['add' => ['assignments.own'], 'remove' => []]],
]);

it('keeps built-in roles, and deletes a custom role only once it is empty', function () {
    $cookies = adminSession();
    $custom = customRole('Desk staff', ['reports.view']);
    $person = User::factory()->role(RoleCode::Volunteer)->create();
    $person->forceFill(['role_id' => $custom->id])->save();

    withAuthCookies($cookies)->patchJson('/api/roles/'.roleId('marshal'), ['name' => 'Field crew'])->assertUnprocessable();
    withAuthCookies($cookies)->deleteJson('/api/roles/'.roleId('marshal'))->assertUnprocessable();
    withAuthCookies($cookies)->deleteJson("/api/roles/{$custom->id}")->assertUnprocessable();

    withAuthCookies($cookies)->patchJson("/api/roles/{$custom->id}", ['name' => 'Front desk', 'description' => 'Office help'])
        ->assertOk()->assertJsonPath('data.name', 'Front desk');

    $person->forceFill(['role_id' => roleId('volunteer')])->save();
    withAuthCookies($cookies)->deleteJson("/api/roles/{$custom->id}")->assertNoContent();

    expect(Role::query()->find($custom->id))->toBeNull()
        ->and(AuditLog::query()->where('action', 'role.deleted')->exists())->toBeTrue();
});

it('moves people into a role and audits each change, but not the admin themselves', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $custom = customRole('Records officer', ['audit.view']);
    $ana = User::factory()->role(RoleCode::Volunteer)->create();
    $ben = User::factory()->role(RoleCode::Marshal)->create();
    $cookies = loginCookies($admin);

    withAuthCookies($cookies)->postJson("/api/roles/{$custom->id}/members", ['user_ids' => [$ana->id, $ben->id]])
        ->assertOk()->assertJsonPath('data.members_count', 2);

    expect($ana->refresh()->role_id)->toBe($custom->id)
        ->and(AuditLog::query()->where('action', 'person.role_changed')->count())->toBe(2);

    withAuthCookies($cookies)->postJson("/api/roles/{$custom->id}/members", ['user_ids' => [$admin->id]])
        ->assertUnprocessable()->assertJsonValidationErrors('user_ids');
    expect($admin->refresh()->role_id)->toBe(roleId('admin'));
});

it('sends a custom office role to the admin side and shows people their own access', function () {
    $clerk = User::factory()->role(RoleCode::Volunteer)->create();
    $clerk->forceFill(['role_id' => customRole('Records officer', ['audit.view'])->id])->save();
    $helper = User::factory()->role(RoleCode::Volunteer)->create();
    $helper->forceFill(['role_id' => customRole('Helper', [])->id])->save();

    withAuthCookies(loginCookies($clerk))->getJson('/api/me')->assertOk()
        ->assertJsonPath('home', '/admin')->assertJsonPath('role', 'records_officer')->assertJsonPath('role_name', 'Records officer');
    withAuthCookies(loginCookies($helper))->getJson('/api/me')->assertOk()->assertJsonPath('home', '/me');

    $access = withAuthCookies(loginCookies($clerk))->getJson('/api/me/access')->assertOk()->json('data');
    expect($access['role']['name'])->toBe('Records officer')
        ->and(array_column($access['permissions'], 'label'))->toContain('View audit log', 'Own profile');
});

it('stops anyone from handing out a role with more access than they hold', function () {
    $manager = User::factory()->role(RoleCode::Volunteer)->create();
    $manager->forceFill(['role_id' => customRole('People desk', ['people.view', 'people.manage'])->id])->save();
    customRole('Records officer', ['audit.view']);
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $cookies = loginCookies($manager);
    $person = fn (array $over = []) => [
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'email' => 'ana.'.uniqid().'@example.test',
        'contact_number' => null, 'role' => 'volunteer', 'team' => null, 'department_id' => null, ...$over,
    ];

    withAuthCookies($cookies)->postJson('/api/people', $person())->assertCreated();
    withAuthCookies($cookies)->postJson('/api/people', $person(['role' => 'records_officer']))->assertForbidden();
    withAuthCookies($cookies)->postJson('/api/people', $person(['role' => 'admin']))->assertForbidden();
    withAuthCookies($cookies)->patchJson("/api/people/{$admin->id}", $person(['email' => $admin->email, 'role' => 'admin']))->assertForbidden();

    $options = collect(withAuthCookies($cookies)->getJson('/api/role-options')->assertOk()->json('data'))->keyBy('code');
    expect($options['volunteer']['can_assign'])->toBeTrue()
        ->and($options['admin']['can_assign'])->toBeFalse()
        ->and($options['records_officer']['can_assign'])->toBeFalse();
});

it('keeps an admin edit and custom roles when the seeder runs again', function () {
    $custom = customRole('Records officer', ['audit.view']);
    Role::query()->where('code', 'coordinator')->firstOrFail()->permissions()
        ->attach(Permission::query()->where('code', 'reports.view')->value('id'));

    $this->seed(PermissionSeeder::class);

    expect(codesOf('coordinator'))->toContain('reports.view')
        ->and(codesOf('records_officer'))->toContain('audit.view')
        ->and(Role::query()->find($custom->id))->not->toBeNull()
        ->and(codesOf('admin'))->toHaveCount(Permission::query()->count());
});

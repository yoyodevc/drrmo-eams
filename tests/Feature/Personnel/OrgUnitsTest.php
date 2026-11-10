<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\Team;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Tests\Support\FakeMailSender;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    app()->instance(MailSender::class, new FakeMailSender);
});

it('lists the starting teams with how many people are in each', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    User::factory()->role(RoleCode::Volunteer)->create(['team' => 'ert']);

    $rows = withAuthCookies(loginCookies($admin))->getJson('/api/teams')->assertOk()->json('data');

    expect(collect($rows)->pluck('name')->all())->toContain('ERT', 'Security team')
        ->and(collect($rows)->firstWhere('code', 'ert')['people_count'])->toBe(1);
});

it('adds, renames and deactivates a team and audits each change', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $as = fn () => withAuthCookies(loginCookies($admin));

    $code = $as()->postJson('/api/teams', ['name' => '  Traffic   control '])
        ->assertCreated()->assertJsonPath('data.name', 'Traffic control')->assertJsonPath('data.code', 'traffic_control')->json('data.code');

    $as()->patchJson("/api/teams/{$code}", ['name' => 'Traffic unit', 'active' => false])
        ->assertOk()->assertJsonPath('data.name', 'Traffic unit')->assertJsonPath('data.active', false)->assertJsonPath('data.code', 'traffic_control');

    expect(AuditLog::query()->whereIn('action', ['team.created', 'team.updated'])->count())->toBe(2);
});

it('rejects a duplicate or blank team name', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();

    withAuthCookies(loginCookies($admin))->postJson('/api/teams', ['name' => 'ert'])->assertUnprocessable()->assertJsonValidationErrors('name');
    withAuthCookies(loginCookies($admin))->postJson('/api/teams', ['name' => ' '])->assertUnprocessable()->assertJsonValidationErrors('name');
});

it('refuses to delete a team that still has people but deletes an empty one', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    User::factory()->role(RoleCode::Volunteer)->create(['team' => 'ert']);
    $empty = Team::query()->create(['code' => 'spare', 'name' => 'Spare']);

    withAuthCookies(loginCookies($admin))->deleteJson('/api/teams/ert')->assertUnprocessable();
    withAuthCookies(loginCookies($admin))->deleteJson('/api/teams/spare')->assertNoContent();

    expect(Team::query()->whereKey($empty->id)->exists())->toBeFalse()
        ->and(AuditLog::query()->where('action', 'team.deleted')->exists())->toBeTrue();
});

it('adds, edits and deletes a department, and blocks one that has people', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $as = fn () => withAuthCookies(loginCookies($admin));

    $id = $as()->postJson('/api/departments', ['name' => 'College of Engineering'])->assertCreated()->assertJsonPath('data.active', true)->json('data.id');
    $as()->patchJson("/api/departments/{$id}", ['name' => 'College of Engineering', 'active' => false])->assertOk()->assertJsonPath('data.active', false);
    $as()->postJson('/api/departments', ['name' => 'College of Engineering'])->assertUnprocessable();

    $busy = Department::query()->create(['name' => 'Security Office']);
    User::factory()->role(RoleCode::Volunteer)->create(['department_id' => $busy->id]);
    $as()->deleteJson("/api/departments/{$busy->id}")->assertUnprocessable();
    $as()->deleteJson("/api/departments/{$id}")->assertNoContent();

    expect(AuditLog::query()->where('action', 'like', 'department.%')->count())->toBe(3);
});

it('keeps non-admins out of team and department changes', function () {
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();
    $dept = Department::query()->create(['name' => 'Security Office']);
    $as = fn () => withAuthCookies(loginCookies($volunteer));

    $as()->getJson('/api/teams')->assertForbidden();
    $as()->postJson('/api/teams', ['name' => 'Nope'])->assertForbidden();
    $as()->patchJson('/api/teams/ert', ['name' => 'Nope'])->assertForbidden();
    $as()->deleteJson('/api/teams/ert')->assertForbidden();
    $as()->postJson('/api/departments', ['name' => 'Nope'])->assertForbidden();
    $as()->patchJson("/api/departments/{$dept->id}", ['name' => 'Nope'])->assertForbidden();
    $as()->deleteJson("/api/departments/{$dept->id}")->assertForbidden();
});

it('only accepts an existing team on a person', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    Team::query()->create(['code' => 'traffic', 'name' => 'Traffic']);
    $body = ['first_name' => 'Ana', 'last_name' => 'Reyes', 'email' => 'ana.reyes@example.test', 'role' => 'volunteer'];

    withAuthCookies(loginCookies($admin))->postJson('/api/people', [...$body, 'team' => 'traffic'])->assertCreated()->assertJsonPath('data.team_name', 'Traffic');
    withAuthCookies(loginCookies($admin))->postJson('/api/people', [...$body, 'email' => 'b@example.test', 'team' => 'ghost'])->assertUnprocessable();
});

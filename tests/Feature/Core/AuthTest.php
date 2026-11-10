<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Database\Seeders\PermissionSeeder;

// Requests must look like they come from the app (VerifyApiRequestOrigin).
beforeEach(function () {
    $this->seed(PermissionSeeder::class);
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
});

function loginAs(User $user, string $password = 'password')
{
    return test()->postJson('/api/login', ['email' => $user->email, 'password' => $password]);
}

it('logs an admin in and sends them to the admin area', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();

    loginAs($admin)
        ->assertOk()
        ->assertJsonPath('data.role', 'admin')
        ->assertJsonPath('data.home', '/admin');

    expect($admin->fresh()->last_login_at)->not->toBeNull();
});

it('sends marshals and volunteers to the phone area', function (RoleCode $role) {
    $user = User::factory()->role($role)->create();

    loginAs($user)->assertOk()->assertJsonPath('data.home', '/me');
})->with([RoleCode::Marshal, RoleCode::Volunteer, RoleCode::Coordinator]);

it('rejects a wrong password with no hint about which part was wrong', function () {
    $user = User::factory()->create();

    loginAs($user, 'nope')->assertStatus(422)->assertJsonPath('code', 'invalid_credentials');
    $this->postJson('/api/login', ['email' => 'nobody@example.test', 'password' => 'x'])
        ->assertStatus(422)->assertJsonPath('code', 'invalid_credentials');
});

it('does not let a disabled account in, and says so only after the right password', function () {
    $user = User::factory()->disabled()->create();

    loginAs($user)->assertStatus(403)->assertJsonPath('code', 'account_disabled');
    loginAs($user, 'nope')->assertStatus(422)->assertJsonPath('code', 'invalid_credentials');
    $this->getJson('/api/me')->assertUnauthorized();
});

it('returns 429 after 5 wrong passwords and writes an audit row', function () {
    $user = User::factory()->create();

    foreach (range(1, 5) as $_) {
        loginAs($user, 'nope')->assertStatus(422);
    }

    loginAs($user)->assertStatus(429)->assertJsonPath('code', 'too_many_attempts');
    expect(AuditLog::query()->where('action', 'auth.login_throttled')->count())->toBe(1);
});

it('resets the failure count after a good login', function () {
    $user = User::factory()->create();

    foreach (range(1, 4) as $_) {
        loginAs($user, 'nope');
    }
    loginAs($user)->assertOk();
    $this->postJson('/api/logout')->assertNoContent();

    foreach (range(1, 4) as $_) {
        loginAs($user, 'nope')->assertStatus(422);
    }
});

it('returns the user with permissions and consent from /api/me', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();

    $this->actingAs($user)->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('data.role', 'marshal')
        ->assertJsonPath('data.consent.privacy_notice', true)
        ->assertJsonPath('data.consent.privacy_notice_outdated', false)
        ->assertJsonPath('data.consent.location_tracking', false)
        ->assertJsonFragment(['permissions' => ['assignments.own', 'location.send_own', 'memos.view', 'messages.use', 'profile.own']])
        ->assertJsonMissingPath('data.password');
});

it('requires a signed-in user for /api/me', function () {
    $this->getJson('/api/me')->assertUnauthorized();
});

it('lets logout succeed even with no session, so signing out never gets stuck', function () {
    $this->postJson('/api/logout')->assertNoContent();
});

<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Tests\Support\FakeMailSender;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->mail = new FakeMailSender;
    app()->instance(MailSender::class, $this->mail);
});

function newPerson(array $over = []): array
{
    return [
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'email' => 'ana.reyes@example.test',
        'contact_number' => '0917 123 4567', 'role' => 'volunteer', 'team' => 'ert', ...$over,
    ];
}

it('creates a person, audits it and emails a set-password link that works', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();

    withAuthCookies(loginCookies($admin))->postJson('/api/people', newPerson(['email' => 'ANA.Reyes@example.test']))
        ->assertCreated()->assertJsonPath('data.email', 'ana.reyes@example.test')->assertJsonPath('data.role', 'volunteer')
        ->assertJsonPath('data.status', 'active')->assertJsonPath('invite_sent', true);

    expect($this->mail->sent)->toHaveCount(1)->and($this->mail->sent[0]['to'])->toBe('ana.reyes@example.test');
    expect(AuditLog::query()->where('action', 'person.created')->exists())->toBeTrue();

    // The emailed link lets the person choose a password and sign in.
    parse_str((string) parse_url($this->mail->lastLink(), PHP_URL_QUERY), $q);
    $this->postJson('/api/reset-password', ['token' => $q['token'], 'email' => $q['email'], 'password' => 'a-long-new-pass-1', 'password_confirmation' => 'a-long-new-pass-1'])->assertOk();
    $this->postJson('/api/login', ['email' => 'ana.reyes@example.test', 'password' => 'a-long-new-pass-1'])->assertOk();
});

it('still creates the person when the email fails and lets the admin resend it', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $this->mail->fail = true;

    $id = withAuthCookies(loginCookies($admin))->postJson('/api/people', newPerson())
        ->assertCreated()->assertJsonPath('invite_sent', false)->json('data.id');

    $this->mail->fail = false;
    withAuthCookies(loginCookies($admin))->postJson("/api/people/{$id}/invite")->assertOk()->assertJsonPath('invite_sent', true);
    expect($this->mail->sent)->toHaveCount(1);
});

it('keeps emails unique and validates the fields', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    User::factory()->create(['email' => 'taken@example.test']);

    withAuthCookies(loginCookies($admin))->postJson('/api/people', newPerson(['email' => 'taken@example.test']))
        ->assertUnprocessable()->assertJsonValidationErrors('email');
    withAuthCookies(loginCookies($admin))->postJson('/api/people', newPerson(['role' => 'king', 'team' => 'x', 'first_name' => '', 'contact_number' => 'abc']))
        ->assertUnprocessable()->assertJsonValidationErrors(['role', 'team', 'first_name', 'contact_number']);
    expect($this->mail->sent)->toBeEmpty();
});

it('edits a person and audits before and after', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $person = User::factory()->role(RoleCode::Volunteer)->create(['email' => 'old@example.test']);
    $dept = Department::query()->create(['name' => 'Security Office']);

    withAuthCookies(loginCookies($admin))->patchJson("/api/people/{$person->id}", newPerson(['email' => 'new@example.test', 'role' => 'marshal', 'department_id' => $dept->id]))
        ->assertOk()->assertJsonPath('data.role', 'marshal')->assertJsonPath('data.department.name', 'Security Office');

    expect($person->refresh()->email)->toBe('new@example.test');
    $log = AuditLog::query()->where('action', 'person.updated')->sole();
    expect($log->meta['before']['email'])->toBe('old@example.test')->and($log->meta['after']['email'])->toBe('new@example.test');
});

it('does not let an admin change their own role', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();

    withAuthCookies(loginCookies($admin))->patchJson("/api/people/{$admin->id}", newPerson(['email' => $admin->email, 'role' => 'volunteer']))->assertUnprocessable();
    expect($admin->refresh()->roleCode())->toBe(RoleCode::Admin);
});

it('lists people with filters and search', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create(['first_name' => 'Zed', 'last_name' => 'Boss']);
    $dept = Department::query()->create(['name' => 'Security Office']);
    User::factory()->role(RoleCode::Volunteer)->create(['first_name' => 'Maria', 'last_name' => 'Santos', 'team' => 'ert', 'department_id' => $dept->id]);
    User::factory()->role(RoleCode::Volunteer)->inactive()->create(['first_name' => 'Jose', 'last_name' => 'Cruz', 'team' => 'security']);
    User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Lina', 'last_name' => 'Diaz']);
    User::factory()->role(RoleCode::Volunteer)->accountStatus(App\Modules\Personnel\Enums\AccountStatus::PendingApproval)->create();

    $get = fn (string $q = '') => withAuthCookies(loginCookies($admin))->getJson('/api/people'.$q)->assertOk();

    $get()->assertJsonCount(4, 'data')->assertJsonPath('meta.total', 4);
    $get('?role=volunteer')->assertJsonCount(2, 'data');
    $get('?team=ert')->assertJsonCount(1, 'data');
    $get('?status=inactive')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Jose Cruz');
    $get("?department={$dept->id}")->assertJsonCount(1, 'data');
    $get('?search=maria santos')->assertJsonCount(1, 'data');
    $get('?search=diaz')->assertJsonCount(1, 'data');
    $get('?role=nonsense')->assertUnprocessable();
});

it('shows one person', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $person = User::factory()->role(RoleCode::Volunteer)->create();

    withAuthCookies(loginCookies($admin))->getJson("/api/people/{$person->id}")->assertOk()->assertJsonPath('data.email', $person->email);
});

it('keeps non-admins out of the people endpoints', function () {
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();
    $other = User::factory()->role(RoleCode::Volunteer)->create();

    withAuthCookies(loginCookies($volunteer))->getJson('/api/people')->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->getJson("/api/people/{$other->id}")->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->getJson('/api/departments')->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->postJson('/api/people', newPerson())->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->patchJson("/api/people/{$other->id}", newPerson())->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->postJson("/api/people/{$other->id}/invite")->assertForbidden();
    $this->getJson('/api/people')->assertUnauthorized();
    expect(User::query()->where('email', 'ana.reyes@example.test')->exists())->toBeFalse();
});

it('lets a person read their profile and change only their contact number', function () {
    $me = User::factory()->role(RoleCode::Volunteer)->create(['email' => 'me@example.test']);

    withAuthCookies(loginCookies($me))->getJson('/api/me/profile')->assertOk()->assertJsonPath('data.email', 'me@example.test');
    withAuthCookies(loginCookies($me))->patchJson('/api/me/profile', ['contact_number' => '09981234567', 'email' => 'hacked@example.test', 'role' => 'admin'])
        ->assertOk()->assertJsonPath('data.contact_number', '09981234567');

    $me->refresh();
    expect($me->email)->toBe('me@example.test')->and($me->roleCode())->toBe(RoleCode::Volunteer);
    withAuthCookies(loginCookies($me))->patchJson('/api/me/profile', ['contact_number' => 'abc'])->assertUnprocessable();
    withAuthCookies(loginCookies($me))->patchJson('/api/me/profile', ['contact_number' => ''])->assertOk()->assertJsonPath('data.contact_number', null);
    $this->getJson('/api/me/profile')->assertUnauthorized();
});

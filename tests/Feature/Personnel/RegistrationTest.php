<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Enums\ConsentPurpose;
use App\Modules\Records\Models\AuditLog;
use App\Modules\Records\Models\ConsentRecord;
use Database\Seeders\PermissionSeeder;
use Illuminate\Testing\TestResponse;
use Tests\Support\FakeMailSender;

beforeEach(function () {
    $this->seed(PermissionSeeder::class);
    $this->mail = new FakeMailSender;
    $this->app->instance(MailSender::class, $this->mail);
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->withAuthCookies([]);
});

function signUp(array $overrides = []): TestResponse
{
    return test()->postJson('/api/register', array_merge([
        'first_name' => 'Pending',
        'last_name' => 'Person',
        'email' => 'pending@example.test',
        'password' => 'a-long-safe-password',
        'password_confirmation' => 'a-long-safe-password',
        'privacy_consent' => true,
    ], $overrides));
}

it('creates a pending volunteer, records consent and emails a 6 digit code', function () {
    signUp()->assertStatus(202)->assertJsonStructure(['message']);

    $user = User::query()->where('email', 'pending@example.test')->firstOrFail();
    expect($user->account_status)->toBe(AccountStatus::PendingEmail)
        ->and($user->roleCode())->toBe(RoleCode::Volunteer)
        ->and($user->verification_code_hash)->not->toBe($this->mail->lastCode())
        ->and($user->verification_code_hash)->toHaveLength(64);
    expect($this->mail->lastCode())->toMatch('/^\d{6}$/');
    expect(ConsentRecord::query()->where('user_id', $user->id)->where('purpose', ConsentPurpose::PrivacyNotice->value)->exists())->toBeTrue();
    expect(AuditLog::query()->where('action', 'registration.requested')->exists())->toBeTrue();
});

it('needs consent and a strong password', function () {
    signUp(['privacy_consent' => false])->assertStatus(422)->assertJsonValidationErrors('privacy_consent');
    signUp(['password' => 'short', 'password_confirmation' => 'short'])->assertStatus(422)->assertJsonValidationErrors('password');
    signUp(['password_confirmation' => 'different-password-1'])->assertStatus(422)->assertJsonValidationErrors('password');
    expect(User::query()->where('email', 'pending@example.test')->exists())->toBeFalse();
});

it('answers the same for an email that is already used and sends nothing', function () {
    User::factory()->create(['email' => 'taken@example.test']);

    $taken = signUp(['email' => 'taken@example.test']);
    $fresh = signUp(['email' => 'new@example.test']);

    expect($taken->status())->toBe($fresh->status())
        ->and($taken->json())->toBe($fresh->json());
    expect(User::query()->where('email', 'taken@example.test')->count())->toBe(1);
    expect(collect($this->mail->sent)->pluck('to')->all())->toBe(['new@example.test']);
});

it('moves to pending approval when the code is right', function () {
    signUp();
    $this->postJson('/api/register/verify', ['email' => 'pending@example.test', 'code' => $this->mail->lastCode()])->assertOk();

    $user = User::query()->where('email', 'pending@example.test')->firstOrFail();
    expect($user->account_status)->toBe(AccountStatus::PendingApproval)
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->verification_code_hash)->toBeNull();
});

it('rejects a wrong code', function () {
    signUp();
    $wrong = $this->mail->lastCode() === '000000' ? '111111' : '000000';

    $this->postJson('/api/register/verify', ['email' => 'pending@example.test', 'code' => $wrong])
        ->assertStatus(422)->assertJson(['code' => 'invalid_code']);
    expect(User::query()->where('email', 'pending@example.test')->value('account_status'))->toBe(AccountStatus::PendingEmail);
});

it('rejects an expired code', function () {
    signUp();
    $this->travel(11)->minutes();

    $this->postJson('/api/register/verify', ['email' => 'pending@example.test', 'code' => $this->mail->lastCode()])
        ->assertStatus(422)->assertJson(['code' => 'invalid_code']);
});

it('locks after five wrong tries even if the right code comes next, until a new code is sent', function () {
    signUp();
    $right = $this->mail->lastCode();
    $wrong = $right === '000000' ? '111111' : '000000';

    foreach (range(1, 4) as $i) {
        $this->postJson('/api/register/verify', ['email' => 'pending@example.test', 'code' => $wrong])->assertJson(['code' => 'invalid_code']);
    }
    $this->postJson('/api/register/verify', ['email' => 'pending@example.test', 'code' => $wrong])->assertJson(['code' => 'code_locked']);
    $this->postJson('/api/register/verify', ['email' => 'pending@example.test', 'code' => $right])->assertJson(['code' => 'code_locked']);

    $this->travel(2)->minutes();
    $this->postJson('/api/register/resend', ['email' => 'pending@example.test'])->assertOk();
    $this->postJson('/api/register/verify', ['email' => 'pending@example.test', 'code' => $this->mail->lastCode()])->assertOk();
});

it('sends one new code at most once a minute', function () {
    signUp();
    $this->postJson('/api/register/resend', ['email' => 'pending@example.test'])->assertOk();
    expect($this->mail->sent)->toHaveCount(1);

    $this->travel(61)->seconds();
    $this->postJson('/api/register/resend', ['email' => 'pending@example.test'])->assertOk();
    expect($this->mail->sent)->toHaveCount(2);
});

it('throttles request access by IP', function () {
    foreach (range(1, 5) as $i) {
        signUp(['email' => "p{$i}@example.test"])->assertStatus(202);
    }
    signUp(['email' => 'p6@example.test'])->assertStatus(429)->assertJson(['code' => 'too_many_attempts']);
});

it('still answers when the email cannot be sent', function () {
    $this->mail->fail = true;
    signUp()->assertStatus(202);
    expect(User::query()->where('email', 'pending@example.test')->exists())->toBeTrue();
});

it('tells a pending or rejected person why they cannot sign in, but only after the right password', function (AccountStatus $status, string $code, string $message) {
    $user = User::factory()->accountStatus($status)->create();

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
        ->assertStatus(403)->assertExactJson(['message' => $message, 'code' => $code]);
    $this->withAuthCookies([])->getJson('/api/me')->assertUnauthorized();
})->with([
    'email not confirmed' => [AccountStatus::PendingEmail, 'email_not_confirmed', 'Confirm your email first. Enter the 6 digit code we sent you.'],
    'waiting for approval' => [AccountStatus::PendingApproval, 'awaiting_approval', 'Your account is waiting for admin approval. We will email you when it is approved.'],
    'rejected' => [AccountStatus::Rejected, 'request_rejected', 'Your access request was not approved. Contact the DRRMO office.'],
]);

it('gives a wrong password or an unknown email the generic message, whatever the account status', function (AccountStatus $status) {
    $user = User::factory()->accountStatus($status)->create();
    $generic = ['code' => 'invalid_credentials', 'message' => 'The email or password is wrong.'];

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'not-the-password'])
        ->assertStatus(422)->assertExactJson($generic);
    $this->postJson('/api/login', ['email' => 'nobody@example.test', 'password' => 'password'])
        ->assertStatus(422)->assertExactJson($generic);
})->with([AccountStatus::PendingEmail, AccountStatus::PendingApproval, AccountStatus::Rejected]);

it('does not sign anyone in or set cookies when the account is not usable', function () {
    $user = User::factory()->accountStatus(AccountStatus::PendingApproval)->create();

    $response = $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])->assertStatus(403);

    expect($this->authCookiesFrom($response))->toBe([]);
    expect($user->fresh()->last_login_at)->toBeNull();
});

it('still throttles repeated tries on an account that cannot sign in yet', function () {
    $user = User::factory()->accountStatus(AccountStatus::PendingApproval)->create();

    foreach (range(1, 5) as $_) {
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])->assertStatus(403);
    }

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
        ->assertStatus(429)->assertJsonPath('code', 'too_many_attempts');
});

it('lets the person in once an admin approves', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $waiting = pendingApproval();

    $this->postJson('/api/login', ['email' => $waiting->email, 'password' => 'password'])->assertStatus(403);
    withAuthCookies(loginCookies($admin))->postJson("/api/admin/registrations/{$waiting->id}/approve")->assertOk();
    $this->postJson('/api/login', ['email' => $waiting->email, 'password' => 'password'])->assertOk();
});

it('stops refreshing and using the app once an account is not active', function () {
    $user = User::factory()->create();
    $cookies = loginCookies($user);
    $user->forceFill(['account_status' => AccountStatus::Rejected])->save();

    withAuthCookies($cookies)->getJson('/api/me')->assertUnauthorized();
    withAuthCookies($cookies)->postJson('/api/refresh')->assertUnauthorized();
});

function pendingApproval(): User
{
    return User::factory()->accountStatus(AccountStatus::PendingApproval)->create(['first_name' => 'Waiting', 'last_name' => 'Person']);
}

it('lets an admin list requests by status', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $waiting = pendingApproval();
    User::factory()->accountStatus(AccountStatus::PendingEmail)->create();
    User::factory()->create(); // a normal active volunteer is not a request

    withAuthCookies(loginCookies($admin))->getJson('/api/admin/registrations')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $waiting->id)
        ->assertJsonPath('counts', ['pending_approval' => 1, 'pending_email' => 1, 'active' => 0, 'rejected' => 0, 'all' => 2]);

    withAuthCookies(loginCookies($admin))->getJson('/api/admin/registrations?status=pending_email')
        ->assertOk()->assertJsonCount(1, 'data');
    withAuthCookies(loginCookies($admin))->getJson('/api/admin/registrations?status=all')
        ->assertOk()->assertJsonCount(2, 'data');
    withAuthCookies(loginCookies($admin))->getJson('/api/admin/registrations?status=nonsense')->assertStatus(422);
});

it('approves a request, audits it, emails the person and lets them sign in', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $waiting = pendingApproval();

    withAuthCookies(loginCookies($admin))->postJson("/api/admin/registrations/{$waiting->id}/approve")
        ->assertOk()->assertJsonPath('data.account_status', 'active');

    expect(AuditLog::query()->where('action', 'registration.approved')->where('entity_id', $waiting->id)->where('actor_id', $admin->id)->exists())->toBeTrue();
    expect($this->mail->sent[0]['to'])->toBe($waiting->email);
    $this->postJson('/api/login', ['email' => $waiting->email, 'password' => 'password'])->assertOk();
});

it('rejects a request with a reason that is kept, audited and emailed', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $waiting = pendingApproval();
    $url = "/api/admin/registrations/{$waiting->id}/reject";

    withAuthCookies(loginCookies($admin))->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors('reason');
    withAuthCookies(loginCookies($admin))->postJson($url, ['reason' => 'Not a ZPPSU volunteer'])
        ->assertOk()->assertJsonPath('data.account_status', 'rejected');

    $waiting->refresh();
    expect($waiting->rejection_reason)->toBe('Not a ZPPSU volunteer')->and($waiting->reviewed_by)->toBe($admin->id);
    $log = AuditLog::query()->where('action', 'registration.rejected')->firstOrFail();
    expect($log->meta['reason'])->toBe('Not a ZPPSU volunteer');
    expect($this->mail->sent[0]['body'])->toContain('Not a ZPPSU volunteer');
    $this->postJson('/api/login', ['email' => $waiting->email, 'password' => 'password'])->assertStatus(403)->assertJsonPath('code', 'request_rejected');
});

it('does not decide a request twice or before the email is confirmed', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $unconfirmed = User::factory()->accountStatus(AccountStatus::PendingEmail)->create();
    $done = pendingApproval();
    $done->forceFill(['account_status' => AccountStatus::Rejected])->save();

    withAuthCookies(loginCookies($admin))->postJson("/api/admin/registrations/{$unconfirmed->id}/approve")->assertStatus(409);
    withAuthCookies(loginCookies($admin))->postJson("/api/admin/registrations/{$done->id}/approve")->assertStatus(409);
});

it('forbids everyone but an admin from the review endpoints', function (RoleCode $role) {
    $actor = User::factory()->role($role)->create();
    $waiting = pendingApproval();
    $cookies = loginCookies($actor);

    withAuthCookies($cookies)->getJson('/api/admin/registrations')->assertForbidden();
    withAuthCookies($cookies)->postJson("/api/admin/registrations/{$waiting->id}/approve")->assertForbidden();
    withAuthCookies($cookies)->postJson("/api/admin/registrations/{$waiting->id}/reject", ['reason' => 'nope'])->assertForbidden();
    // Forbidden even with invalid input: the policy runs before validation.
    withAuthCookies($cookies)->postJson("/api/admin/registrations/{$waiting->id}/reject", [])->assertForbidden();

    expect($waiting->refresh()->account_status)->toBe(AccountStatus::PendingApproval);
})->with([RoleCode::Volunteer, RoleCode::Marshal, RoleCode::Coordinator]);

it('needs a signed in user for the review endpoints', function () {
    $this->withAuthCookies([])->getJson('/api/admin/registrations')->assertUnauthorized();
});

it('needs a first name and a last name, trims them and limits them to 100 characters', function () {
    signUp(['first_name' => '   '])->assertStatus(422)->assertJsonValidationErrors('first_name');
    signUp(['last_name' => ''])->assertStatus(422)->assertJsonValidationErrors('last_name');
    signUp(['first_name' => str_repeat('a', 101)])->assertStatus(422)->assertJsonValidationErrors('first_name');
    signUp(['last_name' => str_repeat('a', 101)])->assertStatus(422)->assertJsonValidationErrors('last_name');
    expect(User::query()->count())->toBe(0);

    signUp(['first_name' => '  Ana  ', 'last_name' => ' Reyes '])->assertStatus(202);
    $user = User::query()->firstOrFail();
    expect($user->first_name)->toBe('Ana')->and($user->last_name)->toBe('Reyes')->and($user->name)->toBe('Ana Reyes');
    expect($this->mail->sent[0]['body'])->toContain('Hello Ana Reyes');
});

it('returns first name, last name and the full name in the review list', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    pendingApproval();

    withAuthCookies(loginCookies($admin))->getJson('/api/admin/registrations')
        ->assertOk()
        ->assertJsonPath('data.0.first_name', 'Waiting')
        ->assertJsonPath('data.0.last_name', 'Person')
        ->assertJsonPath('data.0.name', 'Waiting Person');
});

it('returns the names in /api/me', function () {
    $user = User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Reyes']);

    withAuthCookies(loginCookies($user))->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('data.first_name', 'Ana')
        ->assertJsonPath('data.last_name', 'Reyes')
        ->assertJsonPath('data.name', 'Ana Reyes');
});

it('sends the confirmation code as a branded HTML email with a plain text fallback', function () {
    signUp()->assertStatus(202);

    $sent = end($this->mail->sent);
    expect($sent['html'])->toContain('Confirm your email')->toContain($this->mail->lastCode())
        ->and($sent['body'])->toContain('Your confirmation code is '.$this->mail->lastCode());
});

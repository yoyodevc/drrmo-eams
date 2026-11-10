<?php

declare(strict_types=1);

use App\Modules\Personnel\Models\User;
use App\Modules\Records\Enums\ConsentPurpose;
use App\Modules\Records\Models\AuditLog;
use App\Modules\Records\Models\ConsentRecord;
use Database\Seeders\PermissionSeeder;

// Requests must look like they come from the app (VerifyApiRequestOrigin).
beforeEach(function () {
    $this->seed(PermissionSeeder::class);
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
});

function privacyRows(User $user): int
{
    return ConsentRecord::query()->where('user_id', $user->id)->where('purpose', ConsentPurpose::PrivacyNotice->value)->count();
}

it('blocks the API with consent_required until the person agrees', function () {
    $user = User::factory()->withoutConsent()->create();

    $this->actingAs($user)->getJson('/api/me/notifications')
        ->assertForbidden()
        ->assertJsonPath('code', 'consent_required');
});

it('keeps me and the agree call open without consent', function () {
    $user = User::factory()->withoutConsent()->create();

    $this->actingAs($user)->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('data.consent.privacy_notice', false)
        ->assertJsonPath('data.consent.privacy_notice_outdated', false);
});

it('stores the notice version, time and IP when the person agrees', function () {
    $user = User::factory()->withoutConsent()->create();

    $this->actingAs($user)->postJson('/api/consent/privacy-notice')->assertNoContent();

    $row = ConsentRecord::query()->where('user_id', $user->id)->sole();
    expect($row->purpose)->toBe(ConsentPurpose::PrivacyNotice)
        ->and($row->notice_version)->toBe(config('privacy.notice_version'))
        ->and($row->consented_at)->not->toBeNull()
        ->and($row->ip_address)->not->toBeNull();
    expect(AuditLog::query()->where('action', 'consent.given')->where('actor_id', $user->id)->exists())->toBeTrue();
    $this->getJson('/api/me')->assertJsonPath('data.consent.privacy_notice', true);
});

it('does not write a second row when they agree twice', function () {
    $user = User::factory()->withoutConsent()->create();

    $this->actingAs($user)->postJson('/api/consent/privacy-notice')->assertNoContent();
    $this->postJson('/api/consent/privacy-notice')->assertNoContent();

    expect(privacyRows($user))->toBe(1);
});

it('lets the API through again after agreeing', function () {
    $user = User::factory()->withoutConsent()->create();

    $this->actingAs($user)->postJson('/api/consent/privacy-notice')->assertNoContent();

    $this->getJson('/api/me/notifications')->assertStatus(200);
});

it('asks again when the notice version changes and says it changed', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->getJson('/api/me/notifications')->assertOk();

    config(['privacy.notice_version' => '2099-01-v2']);

    $this->getJson('/api/me/notifications')->assertForbidden()->assertJsonPath('code', 'consent_required');
    $this->getJson('/api/me')
        ->assertJsonPath('data.consent.privacy_notice', false)
        ->assertJsonPath('data.consent.privacy_notice_outdated', true);

    $this->postJson('/api/consent/privacy-notice')->assertNoContent();
    expect(privacyRows($user))->toBe(2);
    $this->getJson('/api/me/notifications')->assertOk();
});

it('needs a signed-in person to agree', function () {
    $this->postJson('/api/consent/privacy-notice')->assertUnauthorized();
});

it('keeps the notice text on the version the server stores', function () {
    $source = (string) file_get_contents(base_path('resources/js/features/records/PrivacyNotice.tsx'));

    expect($source)->toContain("NOTICE_VERSION = '".config('privacy.notice_version')."'");
});

<?php

declare(strict_types=1);

use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\ConsentChecker;
use App\Modules\Records\Enums\ConsentPurpose;
use App\Modules\Records\Models\ConsentRecord;

function giveConsent(User $user, ConsentPurpose $purpose, ?DateTimeInterface $withdrawn = null): ConsentRecord
{
    return ConsentRecord::query()->create([
        'user_id' => $user->id,
        'purpose' => $purpose,
        'notice_version' => config('privacy.notice_version'),
        'consented_at' => now(),
        'withdrawn_at' => $withdrawn,
    ]);
}

it('says no when the user never consented', function () {
    $user = User::factory()->withoutConsent()->create();

    expect(app(ConsentChecker::class)->has($user, ConsentPurpose::PrivacyNotice))->toBeFalse();
});

it('says yes after consent and only for that purpose', function () {
    $user = User::factory()->withoutConsent()->create();
    giveConsent($user, ConsentPurpose::PrivacyNotice);
    $checker = app(ConsentChecker::class);

    expect($checker->has($user, ConsentPurpose::PrivacyNotice))->toBeTrue()
        ->and($checker->has($user, ConsentPurpose::LocationTracking))->toBeFalse();
});

it('says no after consent is withdrawn', function () {
    $user = User::factory()->withoutConsent()->create();
    giveConsent($user, ConsentPurpose::LocationTracking, now());

    expect(app(ConsentChecker::class)->has($user, ConsentPurpose::LocationTracking))->toBeFalse();
});

it('does not count another person consent', function () {
    $other = User::factory()->withoutConsent()->create();
    $user = User::factory()->withoutConsent()->create();
    giveConsent($other, ConsentPurpose::PrivacyNotice);

    expect(app(ConsentChecker::class)->has($user, ConsentPurpose::PrivacyNotice))->toBeFalse();
});

it('asks again when the notice version changes', function () {
    $user = User::factory()->withoutConsent()->create();
    giveConsent($user, ConsentPurpose::PrivacyNotice);
    $checker = app(ConsentChecker::class);
    expect($checker->has($user, ConsentPurpose::PrivacyNotice))->toBeTrue()
        ->and($checker->outdated($user, ConsentPurpose::PrivacyNotice))->toBeFalse();

    config(['privacy.notice_version' => '2099-01-v2']);

    expect($checker->has($user, ConsentPurpose::PrivacyNotice))->toBeFalse()
        ->and($checker->outdated($user, ConsentPurpose::PrivacyNotice))->toBeTrue();
});

it('does not call a person outdated when they never consented', function () {
    $user = User::factory()->withoutConsent()->create();

    expect(app(ConsentChecker::class)->outdated($user, ConsentPurpose::PrivacyNotice))->toBeFalse();
});

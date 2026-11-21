<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Models\EmergencyContact;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
});

it('gives a person only their own data and audits the download', function () {
    $me = User::factory()->role(RoleCode::Volunteer)->create(['first_name' => 'Mia']);
    $other = User::factory()->role(RoleCode::Volunteer)->create();
    EmergencyContact::query()->create(['user_id' => $me->id, 'name' => 'Ana Reyes', 'relationship' => 'Sister', 'phone' => '09170000001']);
    EmergencyContact::query()->create(['user_id' => $other->id, 'name' => 'Not Mine', 'relationship' => 'Friend', 'phone' => '09170000002']);

    $res = withAuthCookies(loginCookies($me))->getJson('/api/me/data-export')->assertOk();

    $res->assertJsonPath('profile.email', $me->email)
        ->assertJsonCount(1, 'emergency_contacts')
        ->assertJsonPath('emergency_contacts.0.name', 'Ana Reyes')
        ->assertJsonStructure(['exported_at', 'profile', 'emergency_contacts', 'assignments', 'consents']);
    expect($res->headers->get('Content-Disposition'))->toContain('my-drrmo-data.json')
        ->and(AuditLog::query()->where('action', 'data.exported')->where('actor_id', $me->id)->count())->toBe(1);
});

it('refuses the export to someone who is not signed in', function () {
    $this->getJson('/api/me/data-export')->assertUnauthorized();
});

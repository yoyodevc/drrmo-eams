<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Models\EmergencyContact;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
});

const CONTACT = ['name' => 'Maria Santos', 'relationship' => 'Mother', 'phone' => '0917 123 4567'];

it('lets a person add, edit and delete their own contacts', function () {
    $me = User::factory()->role(RoleCode::Volunteer)->create();

    $id = withAuthCookies(loginCookies($me))->postJson('/api/me/emergency-contacts', CONTACT)
        ->assertCreated()->assertJsonPath('data.name', 'Maria Santos')->json('data.id');

    withAuthCookies(loginCookies($me))->putJson("/api/me/emergency-contacts/{$id}", [...CONTACT, 'phone' => '09981234567'])
        ->assertOk()->assertJsonPath('data.phone', '09981234567');

    withAuthCookies(loginCookies($me))->getJson('/api/me/emergency-contacts')->assertOk()->assertJsonCount(1, 'data');

    withAuthCookies(loginCookies($me))->deleteJson("/api/me/emergency-contacts/{$id}")->assertOk();
    expect(EmergencyContact::query()->count())->toBe(0);
    expect(AuditLog::query()->where('action', 'emergency_contact.deleted')->exists())->toBeTrue();
});

it('validates the fields and caps the list', function () {
    $me = User::factory()->role(RoleCode::Volunteer)->create();

    withAuthCookies(loginCookies($me))->postJson('/api/me/emergency-contacts', ['name' => '', 'relationship' => 'x', 'phone' => 'abc'])
        ->assertUnprocessable()->assertJsonValidationErrors(['name', 'relationship', 'phone']);

    foreach (range(1, 5) as $i) {
        $me->emergencyContacts()->create([...CONTACT, 'name' => "Person {$i}"]);
    }
    withAuthCookies(loginCookies($me))->postJson('/api/me/emergency-contacts', CONTACT)->assertUnprocessable();
});

it('only shows a person their own contacts', function () {
    $me = User::factory()->role(RoleCode::Volunteer)->create();
    $other = User::factory()->role(RoleCode::Volunteer)->create();
    $theirs = $other->emergencyContacts()->create(CONTACT);

    withAuthCookies(loginCookies($me))->getJson('/api/me/emergency-contacts')->assertOk()->assertJsonCount(0, 'data');
    withAuthCookies(loginCookies($me))->putJson("/api/me/emergency-contacts/{$theirs->id}", CONTACT)->assertForbidden();
    withAuthCookies(loginCookies($me))->deleteJson("/api/me/emergency-contacts/{$theirs->id}")->assertForbidden();
    expect($theirs->fresh())->not->toBeNull();
});

it('lets an admin read a persons contacts and audits it', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();
    $volunteer->emergencyContacts()->create(CONTACT);

    withAuthCookies(loginCookies($admin))->getJson("/api/admin/people/{$volunteer->id}/emergency-contacts")
        ->assertOk()->assertJsonPath('data.0.phone', '0917 123 4567');
    expect(AuditLog::query()->where('action', 'emergency_contact.viewed')->exists())->toBeTrue();
});

it('keeps non-admins from reading other peoples contacts', function () {
    $me = User::factory()->role(RoleCode::Volunteer)->create();
    $other = User::factory()->role(RoleCode::Volunteer)->create();
    $other->emergencyContacts()->create(CONTACT);

    withAuthCookies(loginCookies($me))->getJson("/api/admin/people/{$other->id}/emergency-contacts")->assertForbidden();
    $this->withAuthCookies([])->getJson('/api/me/emergency-contacts')->assertUnauthorized();
});

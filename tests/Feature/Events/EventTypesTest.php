<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventType;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
});

it('lists the starting event types with how many events use each', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    Event::factory()->create(['event_type' => 'drill']);

    $rows = withAuthCookies(loginCookies($admin))->getJson('/api/event-types')->assertOk()->json('data');

    expect(collect($rows)->pluck('name')->all())->toContain('Academic', 'Drill')
        ->and(collect($rows)->firstWhere('code', 'drill')['events_count'])->toBe(1);
});

it('adds, renames and deactivates a type, audits it, and hides inactive ones from the event form', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $as = fn () => withAuthCookies(loginCookies($admin));

    $code = $as()->postJson('/api/event-types', ['name' => '  Medical  mission '])
        ->assertCreated()->assertJsonPath('data.code', 'medical_mission')->json('data.code');

    expect(collect($as()->getJson('/api/event-lookups')->json('data.event_types'))->pluck('value'))->toContain($code);

    $as()->patchJson("/api/event-types/{$code}", ['name' => 'Medical', 'active' => false])
        ->assertOk()->assertJsonPath('data.code', $code)->assertJsonPath('data.active', false);

    expect(collect($as()->getJson('/api/event-lookups')->json('data.event_types'))->pluck('value'))->not->toContain($code)
        ->and(AuditLog::query()->whereIn('action', ['event_type.created', 'event_type.updated'])->count())->toBe(2);
});

it('rejects a duplicate name and an unknown type on an event', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();

    withAuthCookies(loginCookies($admin))->postJson('/api/event-types', ['name' => 'drill'])->assertUnprocessable()->assertJsonValidationErrors('name');
    withAuthCookies(loginCookies($admin))->postJson('/api/events', ['title' => 'X', 'event_type' => 'nope'])->assertUnprocessable()->assertJsonValidationErrors('event_type');
});

it('refuses to delete a type that events use but deletes an unused one', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    Event::factory()->create(['event_type' => 'drill']);
    $unused = EventType::query()->create(['code' => 'spare', 'name' => 'Spare']);

    withAuthCookies(loginCookies($admin))->deleteJson('/api/event-types/drill')->assertUnprocessable();
    withAuthCookies(loginCookies($admin))->deleteJson('/api/event-types/spare')->assertNoContent();
    expect(EventType::query()->whereKey($unused->id)->exists())->toBeFalse();
});

it('forbids a volunteer from managing event types', function () {
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();
    $as = fn () => withAuthCookies(loginCookies($volunteer));

    $as()->getJson('/api/event-types')->assertForbidden();
    $as()->postJson('/api/event-types', ['name' => 'Sneaky'])->assertForbidden();
    $as()->patchJson('/api/event-types/drill', ['name' => 'Sneaky'])->assertForbidden();
    $as()->deleteJson('/api/event-types/other')->assertForbidden();
});

it('adds, edits and deactivates a campus location and hides it from the event form', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $as = fn () => withAuthCookies(loginCookies($admin));

    $id = $as()->postJson('/api/campus-locations', ['name' => ' New  gym ', 'latitude' => 7.83, 'longitude' => 123.43])
        ->assertCreated()->assertJsonPath('data.name', 'New gym')->json('data.id');
    $as()->postJson('/api/campus-locations', ['name' => 'Bad', 'latitude' => 200, 'longitude' => 1])->assertUnprocessable()->assertJsonValidationErrors('latitude');

    expect(collect($as()->getJson('/api/event-lookups')->json('data.locations'))->pluck('id'))->toContain($id);

    $as()->patchJson("/api/campus-locations/{$id}", ['name' => 'New gym', 'latitude' => 7.83, 'longitude' => 123.43, 'active' => false])->assertOk();

    expect(collect($as()->getJson('/api/event-lookups')->json('data.locations'))->pluck('id'))->not->toContain($id)
        ->and(AuditLog::query()->whereIn('action', ['location.created', 'location.updated'])->count())->toBe(2);
});

it('blocks deleting a location that events use and forbids volunteers', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $event = Event::factory()->create();
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();

    withAuthCookies(loginCookies($admin))->deleteJson("/api/campus-locations/{$event->campus_location_id}")->assertUnprocessable();
    withAuthCookies(loginCookies($volunteer))->getJson('/api/campus-locations')->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->deleteJson("/api/campus-locations/{$event->campus_location_id}")->assertForbidden();
});

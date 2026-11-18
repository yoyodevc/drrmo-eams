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

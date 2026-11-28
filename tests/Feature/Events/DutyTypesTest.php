<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Events\Models\DutyRequirement;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
});

it('adds and deactivates a duty type, audits it, and keeps inactive ones out of events', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $event = Event::factory()->create();
    $as = fn () => withAuthCookies(loginCookies($admin));
    $offered = fn () => collect($as()->getJson('/api/event-lookups')->json('data.task_types'))->pluck('id');

    $id = $as()->postJson('/api/duty-types', ['name' => '  First  aid '])
        ->assertCreated()->assertJsonPath('data.name', 'First aid')->json('data.id');
    $as()->postJson('/api/duty-types', ['name' => 'First aid'])->assertUnprocessable()->assertJsonValidationErrors('name');
    expect($offered())->toContain($id);

    $as()->patchJson("/api/duty-types/{$id}", ['name' => 'First aid', 'active' => false])->assertOk();

    expect($offered())->not->toContain($id)
        ->and(AuditLog::query()->whereIn('action', ['duty_type.created', 'duty_type.updated'])->count())->toBe(2);
    $as()->postJson("/api/events/{$event->id}/requirements", ['duty_type_id' => $id])
        ->assertUnprocessable()->assertJsonValidationErrors('duty_type_id');
});

it('refuses to delete a duty type that a duty uses but deletes an unused one', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $used = DutyType::query()->create(['name' => 'Used']);
    $spare = DutyType::query()->create(['name' => 'Spare']);
    $event = Event::factory()->create();
    DutyRequirement::query()->create([
        'event_id' => $event->id, 'duty_type_id' => $used->id, 'role' => 'marshal', 'headcount' => 1,
        'shift_starts_at' => $event->starts_at, 'shift_ends_at' => $event->ends_at,
    ]);

    withAuthCookies(loginCookies($admin))->deleteJson("/api/duty-types/{$used->id}")->assertUnprocessable();
    withAuthCookies(loginCookies($admin))->deleteJson("/api/duty-types/{$spare->id}")->assertNoContent();
    expect(DutyType::query()->whereKey($spare->id)->exists())->toBeFalse();
});

it('forbids a volunteer from managing duty types', function () {
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();
    $id = DutyType::query()->value('id');
    $as = fn () => withAuthCookies(loginCookies($volunteer));

    $as()->getJson('/api/duty-types')->assertForbidden();
    $as()->postJson('/api/duty-types', ['name' => 'Sneaky'])->assertForbidden();
    $as()->patchJson("/api/duty-types/{$id}", ['name' => 'Sneaky'])->assertForbidden();
    $as()->deleteJson("/api/duty-types/{$id}")->assertForbidden();
});

<?php

declare(strict_types=1);

use App\Modules\Access\Contracts\PermissionChecker;
use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Events\Models\Event;
use App\Modules\Personnel\Models\User;

beforeEach(fn () => $this->seed());

/** @param  array<string, mixed>  $over */
function grantFor(User $user, string $code, array $over = []): PermissionGrant
{
    return PermissionGrant::query()->create([
        'user_id' => $user->id,
        'permission_id' => Permission::query()->where('code', $code)->value('id'),
        'starts_at' => now()->subHour(),
        'ends_at' => now()->addHour(),
        'reason' => 'Covering the event',
        ...$over,
    ]);
}

function allows(User $user, string $code, ?int $eventId = null): bool
{
    // A fresh user object, because grants are cached on the object once loaded.
    return app(PermissionChecker::class)->allows($user->fresh(), $code, $eventId);
}

it('allows a role permission and refuses one the role lacks', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();

    expect(allows($admin, 'location.view'))->toBeTrue()
        ->and(allows($volunteer, 'assignments.own'))->toBeTrue()
        ->and(allows($volunteer, 'location.view'))->toBeFalse();
});

it('refuses a person with no grant', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();

    expect(allows($marshal, 'reports.view'))->toBeFalse();
});

it('allows an active grant', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    grantFor($marshal, 'reports.view');

    expect(allows($marshal, 'reports.view'))->toBeTrue()->and($marshal->fresh()->hasPermission('reports.view'))->toBeTrue();
});

it('refuses an expired, upcoming or revoked grant', function (string $kind) {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    grantFor($marshal, 'reports.view', match ($kind) {
        'expired' => ['starts_at' => now()->subDays(2), 'ends_at' => now()->subMinute()],
        'upcoming' => ['starts_at' => now()->addHour(), 'ends_at' => now()->addDay()],
        'revoked' => ['revoked_at' => now()->subMinute()],
    });

    expect(allows($marshal, 'reports.view'))->toBeFalse();
})->with(['expired', 'upcoming', 'revoked']);

it('stops at the exact end time', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    grantFor($marshal, 'reports.view', ['ends_at' => now()->addMinutes(10)]);

    expect(allows($marshal, 'reports.view'))->toBeTrue();
    $this->travel(11)->minutes();
    expect(allows($marshal, 'reports.view'))->toBeFalse();
});

it('matches an event grant only for that event', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create();
    $other = Event::factory()->create();
    grantFor($marshal, 'reports.submit', ['event_id' => $event->id]);

    expect(allows($marshal, 'reports.submit', $event->id))->toBeTrue()
        ->and(allows($marshal, 'reports.submit', $other->id))->toBeFalse()
        ->and(allows($marshal, 'reports.submit'))->toBeFalse();
});

it('lets a grant without an event answer for any event', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create();
    grantFor($marshal, 'location.view');

    expect(allows($marshal, 'location.view', $event->id))->toBeTrue()->and(allows($marshal, 'location.view'))->toBeTrue();
});

it('does not let a grant of one permission open another', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    grantFor($marshal, 'reports.view');

    expect(allows($marshal, 'location.view'))->toBeFalse();
});

it('ignores a grant row for a permission that is not grantable', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    grantFor($marshal, 'people.manage');

    expect(allows($marshal, 'people.manage'))->toBeFalse();
});

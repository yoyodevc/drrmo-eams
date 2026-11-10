<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Modules\Access\Support\PermissionMatrix;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\ConsentChecker;
use App\Modules\Records\Enums\ConsentPurpose;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The signed-in user with role, permission codes and consent status.
 * The React app uses this to pick the layout and to show or hide screens.
 *
 * @mixin User
 */
class MeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('role.permissions', 'activeGrants.event');
        $grants = $this->resource->activeGrants->filter(fn ($g) => $g->permission->grantable);
        $consent = app(ConsentChecker::class);
        $role = $this->resource->role;
        $roleCodes = $role?->permissions->pluck('code') ?? collect();

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $role?->code,
            'role_name' => $role?->name,
            'team' => $this->team,
            'team_name' => $this->teamName(),
            'status' => $this->status->value,
            // Role permissions plus grants that are in force and not tied to one event.
            'permissions' => $roleCodes
                ->merge($grants->whereNull('event_id')->map(fn ($g) => $g->permission->code))
                ->unique()->sort()->values()->all(),
            // Every grant in force now, so the app can show event scoped access and when it ends.
            'grants' => $grants->map(fn ($g) => [
                'permission' => $g->permission->code,
                'event_id' => $g->event_id,
                'event_title' => $g->event?->title,
                'ends_at' => $g->ends_at->toIso8601String(),
            ])->values()->all(),
            'consent' => [
                'privacy_notice' => $consent->has($this->resource, ConsentPurpose::PrivacyNotice),
                // True when they agreed to an older notice version, so the screen can say it changed.
                'privacy_notice_outdated' => $consent->outdated($this->resource, ConsentPurpose::PrivacyNotice),
                'location_tracking' => $consent->has($this->resource, ConsentPurpose::LocationTracking),
            ],
            // Admins, and custom office roles that open an admin screen, land on the desktop area.
            // Built-in field and coordinator roles land on the phone area, even with extra access.
            'home' => $role !== null && ($role->isAdmin() || (! $role->is_system && $roleCodes->intersect(PermissionMatrix::adminCodes())->isNotEmpty()))
                ? '/admin' : '/me',
        ];
    }
}

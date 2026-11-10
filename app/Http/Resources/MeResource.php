<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Modules\Access\Enums\Role as RoleCode;
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
        $this->resource->loadMissing('role.permissions');
        $consent = app(ConsentChecker::class);
        $role = $this->resource->roleCode();

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $role?->value,
            'team' => $this->team?->value,
            'status' => $this->status->value,
            'permissions' => $this->role->permissions->pluck('code')->sort()->values()->all(),
            'consent' => [
                'privacy_notice' => $consent->has($this->resource, ConsentPurpose::PrivacyNotice),
                // True when they agreed to an older notice version, so the screen can say it changed.
                'privacy_notice_outdated' => $consent->outdated($this->resource, ConsentPurpose::PrivacyNotice),
                'location_tracking' => $consent->has($this->resource, ConsentPurpose::LocationTracking),
            ],
            // Admins land on the desktop area, everyone else on the phone area.
            'home' => $role === RoleCode::Admin ? '/admin' : '/me',
        ];
    }
}

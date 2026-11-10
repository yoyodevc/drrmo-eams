<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Resources;

use App\Modules\Access\Models\Role;
use App\Modules\Access\Support\PermissionMatrix;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One role with its permission codes and the cells nobody may change.
 * Load permissions and withCount('users') before passing a role in.
 *
 * @mixin Role
 */
class RoleResource extends JsonResource
{
    public static $wrap = 'data';

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $locks = [];
        foreach (array_keys(PermissionMatrix::permissions()) as $code) {
            $forced = PermissionMatrix::forced($code, $this->code);
            if ($forced !== null) {
                $locks[$code] = ['on' => $forced, 'reason' => PermissionMatrix::lockReason($code, $this->code)];
            }
        }
        $members = (int) ($this->resource->getAttribute('users_count') ?? 0);

        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'is_system' => $this->is_system,
            'is_admin' => $this->isAdmin(),
            'is_field' => $this->isField(),
            'members_count' => $members,
            'permissions' => $this->permissions->pluck('code')->sort()->values()->all(),
            'locks' => (object) $locks,
            'can_delete' => ! $this->is_system && $members === 0,
        ];
    }
}

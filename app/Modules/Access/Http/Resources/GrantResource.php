<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Resources;

use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Access\Support\PermissionMatrix;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PermissionGrant */
class GrantResource extends JsonResource
{
    public static $wrap = 'data';

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'permission' => [
                'code' => $this->permission->code,
                'label' => PermissionMatrix::permissions()[$this->permission->code]['label'] ?? $this->permission->code,
                'description' => $this->permission->description,
            ],
            'person' => ['id' => $this->user_id, 'name' => $this->user?->name],
            'event' => $this->event === null ? null : ['id' => $this->event->id, 'title' => $this->event->title],
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'reason' => $this->reason,
            'status' => $this->status(),
            'granted_by' => $this->grantedBy?->name,
            'revoked_at' => $this->revoked_at?->toIso8601String(),
            'revoked_by' => $this->revokedBy?->name,
        ];
    }
}

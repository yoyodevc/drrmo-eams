<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Resources;

use App\Modules\Events\Models\Assignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Assignment */
class AssignmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->public_code,
            'person' => ['id' => $this->user->public_code, 'name' => $this->user->name, 'email' => $this->user->email],
            'role' => $this->user->role?->code,
            'task_type' => ['id' => $this->dutyType->public_code, 'name' => $this->dutyType->name],
            'status' => $this->status->value,
            'acknowledged_at' => $this->acknowledged_at?->toIso8601String(),
            'override_reason' => $this->override_reason,
        ];
    }
}

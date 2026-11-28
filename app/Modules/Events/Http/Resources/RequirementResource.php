<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Resources;

use App\Modules\Events\Models\DutyRequirement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DutyRequirement */
class RequirementResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->public_code,
            'duty_type' => ['id' => $this->dutyType->public_code, 'name' => $this->dutyType->name],
            'role' => $this->role,
            'team_needed' => $this->team_needed,
            'headcount' => $this->headcount,
            'shift_starts_at' => $this->shift_starts_at->toIso8601String(),
            'shift_ends_at' => $this->shift_ends_at->toIso8601String(),
            'instructions' => $this->instructions,
            'assignments' => AssignmentResource::collection($this->whenLoaded('assignments')),
        ];
    }
}

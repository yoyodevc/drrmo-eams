<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Models\Assignment;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The signed-in person's own duties. Never takes a user id from the request. */
class MyAssignmentController
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $rows = Assignment::query()
            ->where('user_id', $user->id)
            ->whereHas('event', fn ($q) => $q->where('status', '!=', 'draft'))
            ->with(['event.location', 'requirement.dutyType'])
            ->get()
            ->sortBy(fn (Assignment $a) => ($a->requirement !== null ? $a->requirement->shift_starts_at : $a->event->starts_at)->getTimestamp())
            ->values();

        return response()->json(['data' => $rows->map(fn (Assignment $a) => [
            'id' => $a->public_code,
            'status' => $a->status->value,
            'acknowledged_at' => $a->acknowledged_at?->toIso8601String(),
            'duty_started_at' => $a->duty_started_at?->toIso8601String(),
            'duty_ended_at' => $a->duty_ended_at?->toIso8601String(),
            'event' => [
                'id' => $a->event->public_code,
                'title' => $a->event->title,
                'status' => $a->event->status->value,
                'location' => $a->event->location?->name,
            ],
            'duty_type' => $a->requirement?->dutyType->name,
            'team_needed' => $a->requirement?->team_needed,
            'instructions' => $a->requirement?->instructions,
            'starts_at' => ($a->requirement !== null ? $a->requirement->shift_starts_at : $a->event->starts_at)->toIso8601String(),
            'ends_at' => ($a->requirement !== null ? $a->requirement->shift_ends_at : $a->event->ends_at)->toIso8601String(),
        ])]);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Services\DashboardOverview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Admin dashboard: what is happening today, who is on duty, and who needs a nudge. */
class DashboardController
{
    public function __invoke(Request $request, DashboardOverview $overview): JsonResponse
    {
        Gate::authorize('viewAny', Event::class);

        $now = now();
        $events = Event::query()->with('location:id,name')
            ->withCount([
                'assignments as people_count' => fn ($q) => $q->live(),
                'assignments as on_duty_count' => fn ($q) => $q->where('status', AssignmentStatus::OnDuty->value),
            ])
            ->withSum('requirements as places_needed', 'headcount')
            ->where('status', 'published')
            ->where('starts_at', '<=', $now->copy()->endOfDay())
            ->where('ends_at', '>=', $now->copy()->startOfDay())
            ->orderBy('starts_at')->get();

        $base = fn () => Assignment::query()
            ->with(['user:id,first_name,last_name', 'event:id,public_code,title', 'requirement:id,duty_type_id,team_needed,shift_starts_at,shift_ends_at', 'requirement.dutyType:id,name'])
            ->whereHas('event', fn ($q) => $q->where('status', 'published'))
            ->whereHas('requirement', fn ($q) => $q->where('shift_ends_at', '>', $now));

        $row = fn (Assignment $a) => [
            'id' => $a->public_code,
            'person' => $a->user->name,
            'status' => $a->status->value,
            'event' => ['id' => $a->event->public_code, 'title' => $a->event->title],
            'duty' => $a->requirement?->dutyType->name,
            'starts_at' => $a->requirement?->shift_starts_at->toIso8601String(),
            'ends_at' => $a->requirement?->shift_ends_at->toIso8601String(),
            'duty_started_at' => $a->duty_started_at?->toIso8601String(),
        ];

        $unacknowledged = $base()->where('status', AssignmentStatus::Assigned->value)->get()->sortBy('requirement.shift_starts_at')->values();
        // Only people whose duty never started. Anyone on duty or done drops off the list.
        $late = $base()->whereIn('status', [AssignmentStatus::Assigned->value, AssignmentStatus::Acknowledged->value])
            ->whereHas('requirement', fn ($q) => $q->where('shift_starts_at', '<=', $now->copy()->subMinutes(30)))
            ->get()->sortBy('requirement.shift_starts_at')->values();
        // On duty now. The auto end job closes duties 30 minutes after the shift ends.
        $onDuty = Assignment::query()
            ->with(['user:id,first_name,last_name', 'event:id,public_code,title', 'requirement:id,duty_type_id,team_needed,shift_starts_at,shift_ends_at', 'requirement.dutyType:id,name'])
            ->where('status', AssignmentStatus::OnDuty->value)
            ->whereHas('event', fn ($q) => $q->where('status', 'published'))
            ->orderBy('duty_started_at')->get();

        return response()->json(['data' => [
            'today_events' => $events->map(fn (Event $e) => [
                'id' => $e->public_code,
                'title' => $e->title,
                'location' => $e->location?->name,
                'starts_at' => $e->starts_at->toIso8601String(),
                'ends_at' => $e->ends_at->toIso8601String(),
                'people_count' => $e->people_count,
                'on_duty_count' => $e->on_duty_count,
                'places_needed' => (int) $e->places_needed,
            ])->values(),
            'on_duty' => $onDuty->map($row)->values(),
            'unacknowledged' => $unacknowledged->map($row)->values(),
            'not_on_duty' => $late->map($row)->values(),
        ] + $overview->for($request->user())]);
    }
}

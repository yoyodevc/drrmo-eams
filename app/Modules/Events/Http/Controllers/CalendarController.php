<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Events that touch a date range, for the calendar view. Admin only. */
class CalendarController
{
    public function __invoke(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Event::class);
        $data = $request->validate(['from' => ['required', 'date'], 'to' => ['required', 'date', 'after:from']]);

        $events = Event::query()->with(['location:id,name', 'type'])
            ->withCount([
                'assignments as people_count' => fn ($q) => $q->live(),
                'assignments as acknowledged_count' => fn ($q) => $q->where('status', 'acknowledged'),
            ])
            ->withSum('requirements as places_needed', 'headcount')
            ->where('starts_at', '<', $data['to'])->where('ends_at', '>', $data['from'])
            ->orderBy('starts_at')->limit(500)->get();

        return response()->json(['data' => $events->map(fn (Event $e) => [
            'id' => $e->public_code,
            'title' => $e->title,
            'status' => $e->status->value,
            'event_type' => ['value' => $e->event_type, 'label' => $e->typeLabel()],
            'location' => $e->location?->name,
            'starts_at' => $e->starts_at->toIso8601String(),
            'ends_at' => $e->ends_at->toIso8601String(),
            'people_count' => $e->people_count,
            'places_needed' => (int) $e->places_needed,
        ])->values()]);
    }
}

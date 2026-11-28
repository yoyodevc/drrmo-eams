<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Models\Event;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read only notices for coordinators: published events for their department or campus wide. */
class EventNoticeController
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->hasPermission('events.view_department'), 403);

        $events = Event::query()->with(['location:id,name', 'type'])
            ->where('status', 'published')
            ->where('ends_at', '>=', now())
            ->where(fn ($q) => $q->whereNull('department_id')->when($user->department_id, fn ($q2) => $q2->orWhere('department_id', $user->department_id)))
            ->orderBy('starts_at')->limit(50)->get();

        return response()->json(['data' => $events->map(fn (Event $e) => [
            'id' => $e->public_code,
            'title' => $e->title,
            'description' => $e->description,
            'event_type' => $e->typeLabel(),
            'location' => $e->location?->name,
            'campus_wide' => $e->department_id === null,
            'starts_at' => $e->starts_at->toIso8601String(),
            'ends_at' => $e->ends_at->toIso8601String(),
        ])->values()]);
    }
}

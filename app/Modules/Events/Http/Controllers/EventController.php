<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Contracts\AssignmentLookup;
use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Enums\EventStatus;
use App\Modules\Events\Http\Requests\StoreEventRequest;
use App\Modules\Events\Http\Requests\UpdateEventRequest;
use App\Modules\Events\Http\Resources\EventResource;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\Event;
use App\Modules\Notifications\Contracts\AssignmentNotifier;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use BackedEnum;
use DateTimeInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/** Admin screens for events: list and create. */
class EventController
{
    public function index(): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Event::class);

        return EventResource::collection(
            Event::query()->with('location')->orderByDesc('starts_at')->paginate(25),
        );
    }

    public function store(StoreEventRequest $request, AuditLogger $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $event = Event::query()->create([...$request->utcData(), 'status' => EventStatus::Draft, 'created_by' => $user->id]);
        $audit->log('event.created', $event);

        return (new EventResource($event->load('location')))->response()->setStatusCode(201);
    }

    public function show(Event $event): EventResource
    {
        Gate::authorize('viewAny', Event::class);

        return new EventResource($event->load(['location', 'requirements' => fn ($q) => $q->with(['dutyType', 'assignments' => fn ($a) => $a->where('status', '!=', 'cancelled')->with(['user.role', 'dutyType'])->orderBy('id')])->orderBy('shift_starts_at')->orderBy('id')]));
    }

    public function update(UpdateEventRequest $request, Event $event, AuditLogger $audit): EventResource
    {
        abort_unless(in_array($event->status, [EventStatus::Draft, EventStatus::Published], true), 422, 'A cancelled or completed event cannot be edited.');

        $data = $request->utcData();
        $before = array_map($this->plain(...), $event->only(array_keys($data)));
        $event->update($data);
        $after = array_map($this->plain(...), $event->only(array_keys($data)));
        $changed = array_keys(array_diff_assoc($after, $before));
        $audit->log('event.updated', $event, meta: ['before' => array_intersect_key($before, array_flip($changed)), 'after' => array_intersect_key($after, array_flip($changed))]);

        return new EventResource($event->load('location'));
    }

    private function plain(mixed $v): string
    {
        return match (true) {
            $v instanceof BackedEnum => (string) $v->value,
            $v instanceof DateTimeInterface => $v->format('c'),
            default => (string) $v,
        };
    }

    public function publish(Event $event, AuditLogger $audit): EventResource
    {
        Gate::authorize('create', Event::class);
        abort_unless($event->status === EventStatus::Draft, 422, 'Only a draft event can be published.');

        $event->update(['status' => EventStatus::Published]);
        $audit->log('event.published', $event);

        return new EventResource($event->load('location'));
    }

    public function cancel(Event $event, AuditLogger $audit, AssignmentNotifier $notifier, AssignmentLookup $lookup): EventResource
    {
        Gate::authorize('create', Event::class);
        abort_unless(in_array($event->status, [EventStatus::Draft, EventStatus::Published], true), 422, 'This event cannot be cancelled.');

        $event->update(['status' => EventStatus::Cancelled]);
        $audit->log('event.cancelled', $event);
        // Free everyone: places are released, so these people can be assigned to other events again.
        // Duty that already started ends cleanly, and everyone still expected hears about it once.
        Assignment::query()->where('event_id', $event->id)->get()->each(function (Assignment $a) use ($notifier, $lookup) {
            if ($a->status === AssignmentStatus::OnDuty) {
                $lookup->endDuty($a, auto: true);
            } elseif (in_array($a->status, [AssignmentStatus::Assigned, AssignmentStatus::Acknowledged], true)) {
                $a->update(['status' => AssignmentStatus::Cancelled, 'cancelled_at' => now(), 'cancel_reason' => 'Event cancelled']);
                $notifier->cancelled($a);
            }
        });

        return new EventResource($event->load('location'));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Http\Requests\CancelAssignmentRequest;
use App\Modules\Events\Http\Requests\StoreAssignmentRequest;
use App\Modules\Events\Http\Requests\UpdateAssignmentRequest;
use App\Modules\Events\Http\Resources\AssignmentResource;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\DutyRequirement;
use App\Modules\Events\Models\Event;
use App\Modules\Notifications\Contracts\AssignmentNotifier;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/** Admin assigns marshals and volunteers to an event, each with a task type. */
class AssignmentController
{
    /** Approved people with the role this duty needs, not yet on the event. Each shows a clash if their shift overlaps. */
    public function candidates(DutyRequirement $requirement): JsonResponse
    {
        Gate::authorize('assign', Event::class);

        $people = User::query()
            ->with('role:id,code')
            ->where('account_status', 'active')
            ->where('status', 'active')
            ->whereNull('disabled_at')
            ->whereHas('role', fn ($q) => $q->where('code', $requirement->role))
            ->whereNotIn('id', Assignment::query()->where('event_id', $requirement->event_id)->where('status', '!=', 'cancelled')->select('user_id'))
            ->orderBy('first_name')->orderBy('last_name')
            ->get();

        return response()->json(['data' => $people->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'role' => $u->role?->code,
            'conflict' => $requirement->overlapFor($u->id)?->event->title,
        ])->values()]);
    }

    public function store(StoreAssignmentRequest $request, DutyRequirement $requirement, AuditLogger $audit, AssignmentNotifier $notifier): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $override = $requirement->isFull() ? $request->validated('override_reason') : null;
        $fields = [
            'requirement_id' => $requirement->id,
            'duty_type_id' => $requirement->duty_type_id,
            'assigned_by' => $actor->id,
            'status' => AssignmentStatus::Assigned,
            'acknowledged_at' => null,
            'cancelled_at' => null,
            'cancel_reason' => null,
            'override_reason' => $override,
        ];
        // A person taken off this event earlier keeps one row (one per person per event). Bring it back.
        $assignment = Assignment::query()->where('event_id', $requirement->event_id)
            ->where('user_id', $request->validated('user_id'))->where('status', AssignmentStatus::Cancelled->value)->first();
        if ($assignment) {
            $assignment->update($fields);
        } else {
            $assignment = $requirement->assignments()->create([...$fields, 'event_id' => $requirement->event_id, 'user_id' => $request->validated('user_id')]);
        }
        $audit->log('assignment.created', $assignment, meta: array_filter([
            'event_id' => $requirement->event_id,
            'requirement_id' => $requirement->id,
            'user_id' => $assignment->user_id,
            'override_reason' => $override,
        ]));

        $notifier->created($assignment);

        return (new AssignmentResource($assignment->load(['user.role', 'dutyType'])))->response()->setStatusCode(201);
    }

    /** Moves a person to another duty of the same event. */
    public function update(UpdateAssignmentRequest $request, Assignment $assignment, AuditLogger $audit, AssignmentNotifier $notifier): AssignmentResource
    {
        abort_unless(in_array($assignment->status, [AssignmentStatus::Assigned, AssignmentStatus::Acknowledged], true), 422, 'Only an assignment that has not started can be changed.');

        $target = DutyRequirement::query()->findOrFail($request->integer('requirement_id'));
        $before = ['requirement_id' => $assignment->requirement_id, 'duty_type_id' => $assignment->duty_type_id];
        $override = $target->isFull($assignment->id) ? $request->input('override_reason') : null;
        $assignment->update([
            'requirement_id' => $target->id,
            'duty_type_id' => $target->duty_type_id,
            'status' => AssignmentStatus::Assigned,
            'acknowledged_at' => null,
            'override_reason' => $override,
        ]);
        $audit->log('assignment.updated', $assignment, meta: array_filter([
            'event_id' => $assignment->event_id,
            'before' => $before,
            'after' => ['requirement_id' => $target->id, 'duty_type_id' => $target->duty_type_id],
            'override_reason' => $override,
        ]));
        $notifier->changed($assignment);

        return new AssignmentResource($assignment->load(['user.role', 'dutyType']));
    }

    /** Cancels a duty for one person. The row stays so history is kept. */
    public function cancel(CancelAssignmentRequest $request, Assignment $assignment, AuditLogger $audit, AssignmentNotifier $notifier): AssignmentResource
    {
        abort_unless(in_array($assignment->status, [AssignmentStatus::Assigned, AssignmentStatus::Acknowledged], true), 422, 'Only an assignment that has not started can be cancelled.');

        $before = $assignment->status->value;
        $assignment->update([
            'status' => AssignmentStatus::Cancelled,
            'cancelled_at' => now(),
            'cancel_reason' => $request->validated('reason'),
        ]);
        $audit->log('assignment.cancelled', $assignment, meta: [
            'event_id' => $assignment->event_id,
            'user_id' => $assignment->user_id,
            'before' => ['status' => $before],
            'after' => ['status' => 'cancelled'],
            'reason' => $request->validated('reason'),
        ]);
        $notifier->cancelled($assignment);

        return new AssignmentResource($assignment->load(['user.role', 'dutyType']));
    }

    /** Admin marks a person who did not turn up, once the shift has started. */
    public function noShow(Assignment $assignment, AuditLogger $audit): AssignmentResource
    {
        Gate::authorize('assign', Event::class);
        abort_unless(in_array($assignment->status, [AssignmentStatus::Assigned, AssignmentStatus::Acknowledged], true), 422, 'Only an assignment that has not started can be marked no show.');
        abort_unless($assignment->requirement !== null && $assignment->requirement->shift_starts_at->isPast(), 422, 'The shift has not started yet.');

        $before = $assignment->status->value;
        $assignment->update(['status' => AssignmentStatus::NoShow]);
        $audit->log('assignment.no_show', $assignment, meta: ['event_id' => $assignment->event_id, 'user_id' => $assignment->user_id, 'before' => ['status' => $before], 'after' => ['status' => 'no_show'], 'source' => 'admin']);

        return new AssignmentResource($assignment->load(['user.role', 'dutyType']));
    }

    /** Removes an assignment the person has not acknowledged yet, for example one made by mistake. */
    public function destroy(Assignment $assignment, AuditLogger $audit): Response|JsonResponse
    {
        Gate::authorize('assign', Event::class);
        if ($assignment->status !== AssignmentStatus::Assigned) {
            return response()->json(['message' => 'Cancel it with a reason instead.'], 422);
        }

        $audit->log('assignment.deleted', $assignment, meta: ['event_id' => $assignment->event_id, 'user_id' => $assignment->user_id]);
        $assignment->delete();

        return response()->noContent();
    }
}

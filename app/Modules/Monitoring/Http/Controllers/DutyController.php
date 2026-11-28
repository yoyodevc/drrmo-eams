<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Controllers;

use App\Modules\Events\Contracts\AssignmentLookup;
use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Models\Assignment;
use App\Modules\Personnel\Enums\AvailabilityStatus;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\ConsentChecker;
use App\Modules\Records\Enums\ConsentPurpose;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The assigned person starts and ends their own duty. Never takes a user id from the request. */
class DutyController
{
    public function start(Request $request, Assignment $assignment, AssignmentLookup $lookup, ConsentChecker $consent): JsonResponse
    {
        $user = $this->owner($request, $assignment);

        abort_unless($user->status === AvailabilityStatus::Active, 422, 'Your status is inactive. Set yourself active to start duty.');
        abort_unless($consent->has($user, ConsentPurpose::LocationTracking), 422, 'Location consent is needed to start duty.');
        $blocker = $lookup->startBlocker($assignment, now());
        abort_if($blocker !== null, 422, (string) $blocker);

        return $this->respond($lookup->startDuty($assignment));
    }

    public function end(Request $request, Assignment $assignment, AssignmentLookup $lookup): JsonResponse
    {
        $this->owner($request, $assignment);
        abort_unless($assignment->status === AssignmentStatus::OnDuty, 422, 'You are not on duty for this assignment.');

        return $this->respond($lookup->endDuty($assignment));
    }

    private function owner(Request $request, Assignment $assignment): User
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($assignment->user_id === $user->id, 403);

        return $user;
    }

    private function respond(Assignment $assignment): JsonResponse
    {
        return response()->json(['data' => [
            'id' => $assignment->public_code,
            'status' => $assignment->status->value,
            'duty_started_at' => $assignment->duty_started_at?->toIso8601String(),
            'duty_ended_at' => $assignment->duty_ended_at?->toIso8601String(),
        ]]);
    }
}

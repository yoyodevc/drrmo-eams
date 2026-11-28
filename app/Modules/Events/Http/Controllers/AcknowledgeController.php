<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Models\Assignment;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The assigned person confirms they have seen their duty. Repeating it changes nothing. */
class AcknowledgeController
{
    public function __invoke(Request $request, Assignment $assignment, AuditLogger $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($assignment->user_id === $user->id, 403);
        abort_unless(in_array($assignment->status, [AssignmentStatus::Assigned, AssignmentStatus::Acknowledged], true), 422, 'This duty can no longer be acknowledged.');

        if ($assignment->status === AssignmentStatus::Assigned) {
            $assignment->update(['status' => AssignmentStatus::Acknowledged, 'acknowledged_at' => now()]);
            $audit->log('assignment.acknowledged', $assignment, meta: ['event_id' => $assignment->event_id]);
        }

        return response()->json(['data' => [
            'id' => $assignment->public_code,
            'status' => $assignment->status->value,
            'acknowledged_at' => $assignment->acknowledged_at?->toIso8601String(),
        ]]);
    }
}

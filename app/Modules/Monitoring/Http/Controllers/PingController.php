<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Controllers;

use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Models\Assignment;
use App\Modules\Monitoring\Http\Requests\StorePingsRequest;
use App\Modules\Monitoring\Models\LocationPing;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\ConsentChecker;
use App\Modules\Records\Enums\ConsentPurpose;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

/** The assigned person uploads their own location points, live or queued while offline. */
class PingController
{
    /** Clock difference allowed between a phone and the server. */
    private const SKEW_MINUTES = 2;

    public function store(StorePingsRequest $request, Assignment $assignment, ConsentChecker $consent): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($assignment->user_id === $user->id && $user->hasPermission('location.send_own'), 403);
        abort_unless($consent->has($user, ConsentPurpose::LocationTracking), 422, 'Location consent is needed to share your location.');

        // Points queued offline may arrive after the duty ended, so a completed duty still accepts them.
        $started = $assignment->duty_started_at;
        abort_unless($started !== null && in_array($assignment->status, [AssignmentStatus::OnDuty, AssignmentStatus::Completed], true), 422, 'You are not on duty for this assignment.');

        $now = now();
        $from = Carbon::instance($started)->subMinutes(self::SKEW_MINUTES);
        $to = ($assignment->duty_ended_at ?? $now)->copy()->addMinutes(self::SKEW_MINUTES);
        $to = $to->gt($now->copy()->addMinutes(self::SKEW_MINUTES)) ? $now->copy()->addMinutes(self::SKEW_MINUTES) : $to;

        $rows = [];
        $rejected = 0;
        /** @var array<int, array{lat: numeric, lng: numeric, accuracy_m?: numeric|null, captured_at: string}> $points */
        $points = $request->validated('points');
        foreach ($points as $point) {
            $at = Carbon::parse($point['captured_at']);
            if ($at->lt($from) || $at->gt($to)) {
                $rejected++;

                continue;
            }
            $rows[] = [
                'assignment_id' => $assignment->id,
                'latitude' => round((float) $point['lat'], 6),
                'longitude' => round((float) $point['lng'], 6),
                'accuracy_m' => isset($point['accuracy_m']) ? (int) round((float) $point['accuracy_m']) : null,
                'captured_at' => $at->utc()->format('Y-m-d H:i:s'),
                'received_at' => $now->copy()->utc()->format('Y-m-d H:i:s'),
            ];
        }

        abort_if($rows === [] && $rejected > 0, 422, 'No points fall inside your duty window.');
        if ($rows !== []) {
            LocationPing::query()->insert($rows);
        }

        return response()->json(['data' => ['accepted' => count($rows), 'rejected' => $rejected]]);
    }
}

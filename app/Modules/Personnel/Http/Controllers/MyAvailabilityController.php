<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Personnel\Models\User;
use App\Modules\Personnel\Models\VolunteerStatusLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** What a person sees about their own availability: current status and every change. */
class MyAvailabilityController
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $history = $user->statusLogs()->with('changedBy:id,first_name,last_name')->latest('id')->limit(50)->get();

        return response()->json(['data' => [
            'status' => $user->status->value,
            'history' => $history->map(fn (VolunteerStatusLog $l) => [
                'id' => $l->id,
                'old_status' => $l->old_status->value,
                'new_status' => $l->new_status->value,
                'reason' => $l->reason,
                'changed_by' => $l->changedBy?->name,
                'changed_at' => $l->created_at?->toIso8601String(),
            ])->values(),
        ]]);
    }
}

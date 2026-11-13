<?php

declare(strict_types=1);

namespace App\Modules\Records\Http\Controllers;

use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use App\Modules\Records\Contracts\ConsentChecker;
use App\Modules\Records\Contracts\ConsentRecorder;
use App\Modules\Records\Enums\ConsentPurpose;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Location consent (S4.1 follow-up). Only ever touches the signed-in person's own consent. */
class LocationConsentController
{
    public function store(Request $request, ConsentChecker $checker, ConsentRecorder $recorder, AuditLogger $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->hasPermission('location.send_own'), 403);

        // A double tap or a second tab must not write a second row.
        if (! $checker->has($user, ConsentPurpose::LocationTracking)) {
            $recorder->give($user, ConsentPurpose::LocationTracking, $request->ip());
            $audit->log('consent.given', $user, null, [
                'purpose' => ConsentPurpose::LocationTracking->value,
                'notice_version' => (string) config('privacy.notice_version'),
            ]);
        }

        return response()->json(null, 204);
    }

    public function destroy(Request $request, ConsentRecorder $recorder, AuditLogger $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($recorder->withdraw($user, ConsentPurpose::LocationTracking)) {
            $audit->log('consent.withdrawn', $user, null, ['purpose' => ConsentPurpose::LocationTracking->value]);
        }

        return response()->json(null, 204);
    }
}

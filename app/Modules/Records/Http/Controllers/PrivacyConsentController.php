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

/** The signed-in person agrees to the current privacy notice. Only ever writes their own consent, so auth is the whole gate. */
class PrivacyConsentController
{
    public function store(Request $request, ConsentChecker $checker, ConsentRecorder $recorder, AuditLogger $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // Agreeing twice (a double tap, a second tab) must not write a second row.
        if (! $checker->has($user, ConsentPurpose::PrivacyNotice)) {
            $recorder->give($user, ConsentPurpose::PrivacyNotice, $request->ip());
            $audit->log('consent.given', $user, null, [
                'purpose' => ConsentPurpose::PrivacyNotice->value,
                'notice_version' => (string) config('privacy.notice_version'),
            ]);
        }

        return response()->json(null, 204);
    }
}

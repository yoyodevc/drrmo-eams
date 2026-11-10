<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\ConsentChecker;
use App\Modules\Records\Enums\ConsentPurpose;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Until a signed-in person agrees to the current privacy notice, every API call answers
 * 403 `consent_required`. Only the calls the consent screen needs stay open.
 */
class EnsurePrivacyConsent
{
    public function __construct(private readonly ConsentChecker $consent) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('api/me', 'api/consent/privacy-notice', 'api/logout')) {
            return $next($request);
        }

        $user = Auth::guard('api')->user();

        if ($user instanceof User && ! $this->consent->has($user, ConsentPurpose::PrivacyNotice)) {
            return response()->json([
                'message' => 'Read and agree to the privacy notice to continue.',
                'code' => 'consent_required',
            ], 403);
        }

        return $next($request);
    }
}

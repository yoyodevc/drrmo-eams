<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Http\Resources\GrantResource;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** A person reads the grants given to them. Only their own rows, so the signed-in check is enough. */
class MyGrantController
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        $grants = $user->grants()->with(['permission', 'user', 'event', 'grantedBy', 'revokedBy'])
            ->where(fn ($q) => $q->active()->orWhere('starts_at', '>', now())->orWhere('ends_at', '>', now()->subDays(30)))
            ->latest('starts_at')->latest('id')->limit(50)->get();

        return GrantResource::collection($grants);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Events\PermissionGranted;
use App\Modules\Access\Events\PermissionRevoked;
use App\Modules\Access\Http\Requests\StoreGrantRequest;
use App\Modules\Access\Http\Resources\GrantResource;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Access\Support\PermissionMatrix;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/** Admin grants manager: list, give and revoke time-limited permissions. */
class GrantController
{
    private const WITH = ['permission', 'user', 'event', 'grantedBy', 'revokedBy'];

    /** Filters: user (id), event (id), active (1 for only grants in force now). */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('manage', PermissionGrant::class);

        $query = PermissionGrant::query()->with(self::WITH);
        if (ctype_digit((string) $request->query('user'))) {
            $query->where('user_id', (int) $request->query('user'));
        }
        if (ctype_digit((string) $request->query('event'))) {
            $query->where('event_id', (int) $request->query('event'));
        }
        if ($request->boolean('active')) {
            $query->active();
        }

        return GrantResource::collection($query->latest('starts_at')->latest('id')->limit(200)->get());
    }

    /** The permissions that can be granted, with the rules the form needs. */
    public function options(): JsonResponse
    {
        Gate::authorize('manage', PermissionGrant::class);

        $data = [];
        foreach (PermissionMatrix::permissions() as $code => $def) {
            if ($def['grantable']) {
                $data[] = [
                    'code' => $code,
                    'label' => $def['label'],
                    'description' => $def['description'],
                    'group' => $def['group'],
                    'needs_event' => $code === 'reports.submit',
                    'max_days' => $code === 'location.view' ? StoreGrantRequest::LOCATION_MAX_DAYS : null,
                ];
            }
        }

        return response()->json(['data' => $data]);
    }

    public function store(StoreGrantRequest $request, AuditLogger $audit): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $permission = Permission::query()->where('code', $request->string('permission')->value())->firstOrFail();

        $grant = DB::transaction(function () use ($request, $admin, $permission, $audit): PermissionGrant {
            $grant = PermissionGrant::query()->create([
                'user_id' => $request->integer('user_id'),
                'permission_id' => $permission->id,
                'event_id' => $request->filled('event_id') ? $request->integer('event_id') : null,
                'starts_at' => $request->startsAt(),
                'ends_at' => $request->endsAt(),
                'reason' => trim($request->string('reason')->value()),
                'granted_by' => $admin->id,
            ]);

            $audit->log('grant.created', $grant, meta: [
                'user_id' => $grant->user_id,
                'permission' => $permission->code,
                'event_id' => $grant->event_id,
                'starts_at' => $grant->starts_at->toIso8601String(),
                'ends_at' => $grant->ends_at->toIso8601String(),
                'reason' => $grant->reason,
            ]);

            return $grant;
        });

        PermissionGranted::dispatch($grant);

        return (new GrantResource($grant->load(self::WITH)))->response()->setStatusCode(201);
    }

    public function revoke(PermissionGrant $grant, Request $request, AuditLogger $audit): GrantResource
    {
        Gate::authorize('manage', PermissionGrant::class);
        abort_unless($grant->revoked_at === null && $grant->ends_at->isFuture(), 422, 'This grant has already ended.');

        /** @var User $admin */
        $admin = $request->user();

        DB::transaction(function () use ($grant, $admin, $audit): void {
            $grant->forceFill(['revoked_at' => now(), 'revoked_by' => $admin->id])->save();

            $audit->log('grant.revoked', $grant, meta: [
                'user_id' => $grant->user_id,
                'permission' => $grant->permission->code,
                'event_id' => $grant->event_id,
            ]);
        });

        PermissionRevoked::dispatch($grant);

        return new GrantResource($grant->load(self::WITH));
    }
}

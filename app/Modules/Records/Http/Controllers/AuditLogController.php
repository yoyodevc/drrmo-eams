<?php

declare(strict_types=1);

namespace App\Modules\Records\Http\Controllers;

use App\Modules\Records\Models\AuditLog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Read-only audit log for admins. Filters by actor, action, entity and date. */
class AuditLogController
{
    /** Dates are stored in UTC and the "day" is a Manila day. */
    private const TIMEZONE = 'Asia/Manila';

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', AuditLog::class);
        $f = $request->validate([
            'actor' => ['nullable', 'string', 'max:100'],
            'action' => ['nullable', 'string', 'max:64'],
            'entity' => ['nullable', 'string', 'max:64'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $query = AuditLog::query()->with('actor:id,public_code,first_name,last_name,email');
        if (! empty($f['actor'])) {
            $like = '%'.addcslashes($f['actor'], '%_\\').'%';
            $query->whereHas('actor', fn ($q) => $q->where('email', 'like', $like)
                ->orWhere('first_name', 'like', $like)->orWhere('last_name', 'like', $like));
        }
        if (! empty($f['action'])) {
            $query->where('action', 'like', addcslashes($f['action'], '%_\\').'%');
        }
        if (! empty($f['entity'])) {
            $query->where('entity', $f['entity']);
        }
        if (! empty($f['from'])) {
            $query->where('created_at', '>=', Carbon::parse($f['from'], self::TIMEZONE)->startOfDay()->utc());
        }
        if (! empty($f['to'])) {
            $query->where('created_at', '<', Carbon::parse($f['to'], self::TIMEZONE)->addDay()->startOfDay()->utc());
        }

        $page = $query->orderByDesc('id')->paginate(25);

        return response()->json([
            'data' => $page->getCollection()->map(fn (AuditLog $l) => [
                'id' => $l->id,
                'action' => $l->action,
                'entity' => $l->entity,
                'entity_id' => $l->entity_id,
                'meta' => $l->meta,
                'ip_address' => $l->ip_address,
                'created_at' => $l->created_at->toIso8601String(),
                'actor' => $l->actor ? ['id' => $l->actor->public_code, 'name' => $l->actor->name, 'email' => $l->actor->email] : null,
            ])->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            // Distinct values for the filter dropdowns.
            'entities' => AuditLog::query()->distinct()->orderBy('entity')->pluck('entity'),
        ]);
    }
}

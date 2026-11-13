<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Controllers;

use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Models\Assignment;
use App\Modules\Monitoring\Models\LocationPing;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The live map (S4.3) and ping trail (S4.4). Location data: `location.view` only, every load audited. */
class MapController
{
    /** A person with no ping for this long shows grey and in the "No ping" list. */
    public const STALE_SECONDS = 300;

    public function latest(Request $request, AuditLogger $audit): JsonResponse
    {
        $this->authorizeView($request);
        $eventId = $request->integer('event_id') ?: null;

        $assignments = Assignment::query()
            ->with(['user', 'event'])
            ->where('status', AssignmentStatus::OnDuty->value)
            ->when($eventId, fn ($q) => $q->where('event_id', $eventId))
            ->get();

        // Latest ping per assignment, served by the (assignment_id, captured_at) index (docs/DATABASE.md).
        $latest = LocationPing::query()
            ->from('location_pings as p')
            ->joinSub(
                LocationPing::query()->selectRaw('assignment_id, MAX(captured_at) as last_at')->whereIn('assignment_id', $assignments->modelKeys())->groupBy('assignment_id'),
                'x',
                fn ($j) => $j->on('x.assignment_id', '=', 'p.assignment_id')->on('x.last_at', '=', 'p.captured_at'),
            )
            ->select('p.*')
            ->get()
            ->keyBy('assignment_id');

        $now = now();
        $people = $assignments->map(function (Assignment $a) use ($latest, $now): array {
            /** @var LocationPing|null $ping */
            $ping = $latest->get($a->id);
            $user = $a->user;

            return [
                'assignment_id' => $a->id,
                'event_id' => $a->event_id,
                'event_title' => $a->event?->title,
                'name' => $user instanceof User ? $user->name : 'Unknown',
                'state' => $ping === null ? 'none' : ($ping->captured_at->diffInSeconds($now, true) >= self::STALE_SECONDS ? 'stale' : 'live'),
                'ping' => $ping === null ? null : [
                    'lat' => $ping->latitude,
                    'lng' => $ping->longitude,
                    'accuracy_m' => $ping->accuracy_m,
                    'captured_at' => $ping->captured_at->toIso8601String(),
                ],
            ];
        })->sortBy('name')->values();

        $audit->log('location.viewed', 'location_ping', null, ['scope' => 'latest', 'event_id' => $eventId, 'people' => $people->count()]);

        return response()->json(['data' => ['people' => $people, 'stale_after_seconds' => self::STALE_SECONDS, 'generated_at' => $now->toIso8601String()]]);
    }

    public function trail(Request $request, Assignment $assignment, AuditLogger $audit): JsonResponse
    {
        $this->authorizeView($request);

        $points = LocationPing::query()
            ->where('assignment_id', $assignment->id)
            ->orderBy('captured_at')
            ->get()
            ->map(fn (LocationPing $p): array => [
                'lat' => $p->latitude,
                'lng' => $p->longitude,
                'accuracy_m' => $p->accuracy_m,
                'captured_at' => $p->captured_at->toIso8601String(),
            ]);

        // One audit row per request, not one per pin.
        $audit->log('location.trail_viewed', $assignment, $assignment->id, ['points' => $points->count()]);

        return response()->json(['data' => ['assignment_id' => $assignment->id, 'points' => $points]]);
    }

    private function authorizeView(Request $request): void
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->hasPermission('location.view'), 403);
    }
}

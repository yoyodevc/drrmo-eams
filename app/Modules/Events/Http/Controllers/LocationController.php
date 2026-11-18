<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Http\Requests\LocationRequest;
use App\Modules\Events\Models\CampusLocation;
use App\Modules\Events\Models\Event;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Campus locations for the event form, plus the admin screen that adds, edits and removes them. */
class LocationController
{
    public function index(): JsonResponse
    {
        Gate::authorize('create', Event::class);

        $rows = CampusLocation::query()->withCount('events')->orderBy('name')->get()
            ->map(fn (CampusLocation $l) => $this->present($l));

        return response()->json(['data' => $rows]);
    }

    public function store(LocationRequest $request, AuditLogger $audit): JsonResponse
    {
        $location = CampusLocation::query()->create([...$request->validated(), 'active' => $request->validated('active') ?? true]);
        $audit->log('location.created', $location, meta: ['after' => $this->snapshot($location)]);

        return response()->json(['data' => $this->present($location->loadCount('events'))], 201);
    }

    public function update(LocationRequest $request, CampusLocation $campusLocation, AuditLogger $audit): JsonResponse
    {
        $before = $this->snapshot($campusLocation);
        $campusLocation->fill($request->validated())->save();

        if ($before !== ($after = $this->snapshot($campusLocation))) {
            $audit->log('location.updated', $campusLocation, meta: ['before' => $before, 'after' => $after]);
        }

        return response()->json(['data' => $this->present($campusLocation->loadCount('events'))]);
    }

    /** A location that events still use cannot be deleted. Deactivate it instead. */
    public function destroy(CampusLocation $campusLocation, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('create', Event::class);
        abort_if($campusLocation->events()->exists(), 422, 'Events still use this location. Deactivate it instead.');

        $snapshot = $this->snapshot($campusLocation);
        $campusLocation->delete();
        $audit->log('location.deleted', 'campus_location', $campusLocation->id, ['before' => $snapshot]);

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function snapshot(CampusLocation $l): array
    {
        return ['name' => $l->name, 'latitude' => $l->latitude, 'longitude' => $l->longitude, 'active' => $l->active];
    }

    /** @return array<string, mixed> */
    private function present(CampusLocation $l): array
    {
        return [...$this->snapshot($l), 'id' => $l->id, 'events_count' => (int) ($l->events_count ?? 0)];
    }
}

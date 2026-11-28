<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Http\Requests\DutyTypeRequest;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** The admin screen that adds, edits and removes the duty types picked when adding a duty to an event. */
class DutyTypeController
{
    public function index(): JsonResponse
    {
        Gate::authorize('create', Event::class);

        $rows = DutyType::query()->withCount(['requirements', 'assignments'])->orderBy('name')->get()
            ->map(fn (DutyType $t) => $this->present($t));

        return response()->json(['data' => $rows]);
    }

    public function store(DutyTypeRequest $request, AuditLogger $audit): JsonResponse
    {
        $type = DutyType::query()->create([
            'name' => $request->validated('name'),
            'active' => $request->validated('active') ?? true,
        ]);
        $audit->log('duty_type.created', $type, meta: ['after' => $this->snapshot($type)]);

        return response()->json(['data' => $this->present($type->loadCount(['requirements', 'assignments']))], 201);
    }

    public function update(DutyTypeRequest $request, DutyType $dutyType, AuditLogger $audit): JsonResponse
    {
        $before = $this->snapshot($dutyType);
        $dutyType->fill($request->validated())->save();

        if ($before !== ($after = $this->snapshot($dutyType))) {
            $audit->log('duty_type.updated', $dutyType, meta: ['before' => $before, 'after' => $after]);
        }

        return response()->json(['data' => $this->present($dutyType->loadCount(['requirements', 'assignments']))]);
    }

    /** A duty type that events still use cannot be deleted. Deactivate it instead. */
    public function destroy(DutyType $dutyType, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('create', Event::class);
        abort_if($dutyType->requirements()->exists() || $dutyType->assignments()->exists(), 422, 'Events still use this duty type. Deactivate it instead.');

        $snapshot = $this->snapshot($dutyType);
        $dutyType->delete();
        $audit->log('duty_type.deleted', 'duty_type', $dutyType->id, ['before' => $snapshot]);

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function snapshot(DutyType $type): array
    {
        return ['name' => $type->name, 'active' => $type->active];
    }

    /** @return array<string, mixed> */
    private function present(DutyType $type): array
    {
        return [
            'id' => $type->id,
            'name' => $type->name,
            'active' => $type->active,
            'duties_count' => (int) (($type->requirements_count ?? 0) ?: ($type->assignments_count ?? 0)),
        ];
    }
}

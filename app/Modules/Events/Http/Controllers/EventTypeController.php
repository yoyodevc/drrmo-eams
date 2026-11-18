<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Http\Requests\EventTypeRequest;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventType;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/** Event types for the event form and filters, plus the admin screen that adds, edits and removes them. */
class EventTypeController
{
    public function index(): JsonResponse
    {
        Gate::authorize('create', Event::class);

        $rows = EventType::query()->withCount('events')->orderBy('name')->get()
            ->map(fn (EventType $t) => $this->present($t));

        return response()->json(['data' => $rows]);
    }

    public function store(EventTypeRequest $request, AuditLogger $audit): JsonResponse
    {
        $name = $request->validated('name');
        $type = EventType::query()->create([
            'code' => $this->uniqueCode($name),
            'name' => $name,
            'active' => $request->validated('active') ?? true,
        ]);
        $audit->log('event_type.created', $type, meta: ['after' => $this->snapshot($type)]);

        return response()->json(['data' => $this->present($type->loadCount('events'))], 201);
    }

    /** The code never changes, so events keep their type when it is renamed. */
    public function update(EventTypeRequest $request, EventType $eventType, AuditLogger $audit): JsonResponse
    {
        $before = $this->snapshot($eventType);
        $eventType->fill($request->validated())->save();

        if ($before !== ($after = $this->snapshot($eventType))) {
            $audit->log('event_type.updated', $eventType, meta: ['before' => $before, 'after' => $after]);
        }

        return response()->json(['data' => $this->present($eventType->loadCount('events'))]);
    }

    /** A type that events still use cannot be deleted. Deactivate it instead. */
    public function destroy(EventType $eventType, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('create', Event::class);
        abort_if($eventType->events()->exists(), 422, 'Events still use this type. Deactivate it instead.');

        $snapshot = $this->snapshot($eventType);
        $eventType->delete();
        $audit->log('event_type.deleted', 'event_type', $eventType->id, ['before' => $snapshot]);

        return response()->json(null, 204);
    }

    private function uniqueCode(string $name): string
    {
        $base = Str::limit(Str::slug($name, '_') ?: 'type', 24, '');
        $code = $base;
        for ($i = 2; EventType::query()->where('code', $code)->exists(); $i++) {
            $code = $base.'_'.$i;
        }

        return $code;
    }

    /** @return array<string, mixed> */
    private function snapshot(EventType $type): array
    {
        return ['code' => $type->code, 'name' => $type->name, 'active' => $type->active];
    }

    /** @return array<string, mixed> */
    private function present(EventType $type): array
    {
        return [
            'code' => $type->code,
            'name' => $type->name,
            'active' => $type->active,
            'events_count' => (int) ($type->events_count ?? 0),
        ];
    }
}

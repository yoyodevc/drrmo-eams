<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Models\CampusLocation;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventType;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Dropdown lists for the event form. */
class LookupController
{
    public function __invoke(): JsonResponse
    {
        Gate::authorize('create', Event::class);

        return response()->json(['data' => [
            'event_types' => EventType::query()->where('active', true)->orderBy('name')->get(['code', 'name'])->map(fn (EventType $t) => ['value' => $t->code, 'label' => $t->name])->values(),
            'task_types' => DutyType::query()->where('active', true)->orderBy('name')->get(['public_code', 'name'])->map(fn (DutyType $t) => ['id' => $t->public_code, 'name' => $t->name])->values(),
            'locations' => CampusLocation::query()->where('active', true)->orderBy('name')->get(['public_code', 'name'])->map(fn (CampusLocation $l) => ['id' => $l->public_code, 'name' => $l->name])->values(),
        ]]);
    }
}

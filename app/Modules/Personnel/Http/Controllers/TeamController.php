<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Personnel\Http\Requests\OrgUnitRequest;
use App\Modules\Personnel\Models\Team;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/** Teams for the people filter and form, plus the admin screen that adds, edits and removes them. */
class TeamController
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewPeople', User::class);

        $rows = Team::query()->withCount('users')->orderBy('name')->get()
            ->map(fn (Team $t) => $this->present($t));

        return response()->json(['data' => $rows]);
    }

    public function store(OrgUnitRequest $request, AuditLogger $audit): JsonResponse
    {
        $name = $request->validated('name');
        $team = Team::query()->create([
            'code' => $this->uniqueCode($name),
            'name' => $name,
            'active' => $request->validated('active') ?? true,
        ]);
        $audit->log('team.created', $team, meta: ['after' => $this->snapshot($team)]);

        return response()->json(['data' => $this->present($team->loadCount('users'))], 201);
    }

    /** The code never changes, so people keep their team when it is renamed. */
    public function update(OrgUnitRequest $request, Team $team, AuditLogger $audit): JsonResponse
    {
        $before = $this->snapshot($team);
        $team->fill($request->validated())->save();

        if ($before !== ($after = $this->snapshot($team))) {
            $audit->log('team.updated', $team, meta: ['before' => $before, 'after' => $after]);
        }

        return response()->json(['data' => $this->present($team->loadCount('users'))]);
    }

    /** A team that still has people cannot be deleted. Deactivate it instead. */
    public function destroy(Team $team, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('managePeople', User::class);
        abort_if($team->users()->exists(), 422, 'This team still has people. Deactivate it instead.');

        $snapshot = $this->snapshot($team);
        $team->delete();
        $audit->log('team.deleted', 'team', $team->id, ['before' => $snapshot]);

        return response()->json(null, 204);
    }

    private function uniqueCode(string $name): string
    {
        $base = Str::limit(Str::slug($name, '_') ?: 'team', 24, '');
        $code = $base;
        for ($i = 2; Team::query()->where('code', $code)->exists(); $i++) {
            $code = $base.'_'.$i;
        }

        return $code;
    }

    /** @return array<string, mixed> */
    private function snapshot(Team $team): array
    {
        return ['code' => $team->code, 'name' => $team->name, 'active' => $team->active];
    }

    /** @return array<string, mixed> */
    private function present(Team $team): array
    {
        return [
            'code' => $team->code,
            'name' => $team->name,
            'active' => $team->active,
            'people_count' => (int) ($team->users_count ?? 0),
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Personnel\Http\Requests\OrgUnitRequest;
use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Departments for the people filter and form, plus the admin screen that adds, edits and removes them. */
class DepartmentController
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewPeople', User::class);

        $rows = Department::query()->withCount('users')->orderBy('name')->get()
            ->map(fn (Department $d) => $this->present($d));

        return response()->json(['data' => $rows]);
    }

    public function store(OrgUnitRequest $request, AuditLogger $audit): JsonResponse
    {
        $department = Department::query()->create([
            'name' => $request->validated('name'),
            'active' => $request->validated('active') ?? true,
        ]);
        $audit->log('department.created', $department, meta: ['after' => $this->snapshot($department)]);

        return response()->json(['data' => $this->present($department->loadCount('users'))], 201);
    }

    public function update(OrgUnitRequest $request, Department $department, AuditLogger $audit): JsonResponse
    {
        $before = $this->snapshot($department);
        $department->fill($request->validated())->save();

        if ($before !== ($after = $this->snapshot($department))) {
            $audit->log('department.updated', $department, meta: ['before' => $before, 'after' => $after]);
        }

        return response()->json(['data' => $this->present($department->loadCount('users'))]);
    }

    /** A department that still has people cannot be deleted. Deactivate it instead. */
    public function destroy(Department $department, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('managePeople', User::class);
        abort_if($department->users()->exists(), 422, 'This department still has people. Deactivate it instead.');

        $snapshot = $this->snapshot($department);
        $department->delete();
        $audit->log('department.deleted', 'department', $department->id, ['before' => $snapshot]);

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function snapshot(Department $department): array
    {
        return ['name' => $department->name, 'active' => $department->active];
    }

    /** @return array<string, mixed> */
    private function present(Department $department): array
    {
        return [
            'id' => $department->id,
            'name' => $department->name,
            'active' => $department->active,
            'people_count' => (int) ($department->users_count ?? 0),
        ];
    }
}

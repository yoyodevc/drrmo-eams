<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Contracts\RoleGuard;
use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Http\Requests\RoleRequest;
use App\Modules\Access\Http\Resources\RoleResource;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\Role;
use App\Modules\Access\Support\PermissionMatrix;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/** Roles: list, add a custom role, rename it, delete it. Built-in roles keep their name. */
class RoleController
{
    public function index(): AnonymousResourceCollection
    {
        Gate::authorize('manage', Role::class);

        return RoleResource::collection(self::ordered()->get());
    }

    /** A short list for the People screens: code, name, and whether this person may hand the role out. */
    public function options(Request $request, RoleGuard $guard): JsonResponse
    {
        Gate::authorize('pick', Role::class);

        /** @var User $actor */
        $actor = $request->user();

        return response()->json(['data' => self::ordered()->get()->map(fn (Role $r) => [
            'code' => $r->code,
            'name' => $r->name,
            'is_system' => $r->is_system,
            'can_assign' => $guard->canHandOut($actor, $r),
        ])->values()]);
    }

    public function show(Role $role): RoleResource
    {
        Gate::authorize('manage', Role::class);

        return new RoleResource($role->load('permissions')->loadCount('users'));
    }

    /** A new custom role. It starts with a copy of another role's permissions, or with the basics only. */
    public function store(RoleRequest $request, AuditLogger $audit): JsonResponse
    {
        $copyFrom = $request->filled('copy_from') ? Role::query()->with('permissions')->findOrFail($request->integer('copy_from')) : null;

        $role = DB::transaction(function () use ($request, $copyFrom, $audit): Role {
            $role = Role::query()->create([
                'code' => $this->uniqueCode($request->string('name')->value()),
                'name' => trim($request->string('name')->value()),
                'description' => $request->filled('description') ? trim($request->string('description')->value()) : null,
                'is_system' => false,
            ]);

            $codes = PermissionMatrix::applyLocks($role->code, $copyFrom?->permissions->pluck('code')->all() ?? []);
            $role->permissions()->sync(Permission::query()->whereIn('code', $codes)->pluck('id'));

            $audit->log('role.created', $role, meta: [
                'name' => $role->name,
                'copied_from' => $copyFrom?->code,
                'permissions' => $codes,
            ]);

            return $role;
        });

        return (new RoleResource($role->load('permissions')->loadCount('users')))->response()->setStatusCode(201);
    }

    public function update(RoleRequest $request, Role $role, AuditLogger $audit): RoleResource
    {
        abort_if($role->is_system, 422, 'Built-in roles keep their name and description.');

        $before = ['name' => $role->name, 'description' => $role->description];
        $role->fill([
            'name' => trim($request->string('name')->value()),
            'description' => $request->filled('description') ? trim($request->string('description')->value()) : null,
        ]);

        if ($role->isDirty()) {
            DB::transaction(function () use ($role, $audit, $before): void {
                $role->save();
                $audit->log('role.updated', $role, meta: ['before' => $before, 'after' => ['name' => $role->name, 'description' => $role->description]]);
            });
        }

        return new RoleResource($role->load('permissions')->loadCount('users'));
    }

    public function destroy(Role $role, AuditLogger $audit): Response
    {
        Gate::authorize('manage', Role::class);
        abort_if($role->is_system, 422, 'Built-in roles cannot be deleted.');

        $members = $role->users()->count();
        abort_if($members > 0, 422, "Move the {$members} ".Str::plural('person', $members).' in this role to another role first.');

        DB::transaction(function () use ($role, $audit): void {
            $audit->log('role.deleted', $role, meta: ['name' => $role->name, 'code' => $role->code, 'permissions' => $role->permissions()->pluck('code')->all()]);
            $role->permissions()->detach();
            $role->delete();
        });

        return response()->noContent();
    }

    /**
     * Built-in roles first in a fixed order, then custom roles by name.
     *
     * @return Builder<Role>
     */
    public static function ordered(): Builder
    {
        $order = array_map(fn (RoleCode $r) => $r->value, RoleCode::cases());

        return Role::query()->with('permissions')->withCount('users')
            ->orderByDesc('is_system')
            ->orderByRaw('case code '.implode(' ', array_map(fn ($c, $i) => "when '{$c}' then {$i}", $order, array_keys($order))).' else 99 end')
            ->orderBy('name');
    }

    /** A code made from the name, for example "Records officer" becomes records_officer. */
    private function uniqueCode(string $name): string
    {
        $base = Str::limit(Str::slug($name, '_'), 28, '');
        if ($base === '' || RoleCode::tryFrom($base) !== null) {
            $base = 'role_'.($base === '' ? Str::lower(Str::random(6)) : $base);
        }

        $code = $base;
        for ($i = 2; Role::query()->where('code', $code)->exists(); $i++) {
            $code = "{$base}_{$i}";
        }

        return $code;
    }
}

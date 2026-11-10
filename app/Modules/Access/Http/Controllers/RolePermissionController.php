<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Http\Resources\RoleResource;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\Role;
use App\Modules\Access\Support\PermissionMatrix;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Saves the permissions of one or more roles at once. The matrix screen sends every changed role,
 * a role's own screen sends just that one. All or nothing: a locked cell anywhere rejects the lot.
 */
class RolePermissionController
{
    public function __invoke(Request $request, AuditLogger $audit): AnonymousResourceCollection
    {
        Gate::authorize('manage', Role::class);

        $request->validate([
            'roles' => ['required', 'array', 'min:1', 'max:50'],
            'roles.*.id' => ['required', 'integer', 'distinct', 'exists:roles,id'],
            'roles.*.permissions' => ['present', 'array'],
            'roles.*.permissions.*' => ['string', 'distinct', Rule::in(array_keys(PermissionMatrix::permissions()))],
        ]);

        /** @var list<array{id: int, permissions: list<string>}> $input */
        $input = $request->input('roles');
        $roles = Role::query()->with('permissions')->whereIn('id', array_column($input, 'id'))->get()->keyBy('id');

        $errors = [];
        foreach ($input as $i => $row) {
            $role = $roles[(int) $row['id']];
            foreach (array_keys(PermissionMatrix::permissions()) as $code) {
                $forced = PermissionMatrix::forced($code, $role->code);
                if ($forced !== null && $forced !== in_array($code, $row['permissions'], true)) {
                    $errors["roles.{$i}.permissions"][] = "{$role->name}: ".PermissionMatrix::lockReason($code, $role->code);
                    break;
                }
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $ids = Permission::query()->pluck('id', 'code');

        DB::transaction(function () use ($input, $roles, $ids, $audit): void {
            foreach ($input as $row) {
                $role = $roles[(int) $row['id']];
                $before = $role->permissions->pluck('code')->all();
                $after = $row['permissions'];
                $added = array_values(array_diff($after, $before));
                $removed = array_values(array_diff($before, $after));
                if ($added === [] && $removed === []) {
                    continue;
                }

                $role->permissions()->sync(array_map(fn (string $code) => $ids[$code], $after));
                $audit->log('role.permissions_changed', $role, meta: ['role' => $role->code, 'added' => $added, 'removed' => $removed]);
            }
        });

        return RoleResource::collection(RoleController::ordered()->get());
    }
}

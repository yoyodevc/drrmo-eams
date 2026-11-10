<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Support\PermissionMatrix;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** A person reads their own role and what it lets them do, in plain words. Only their own data. */
class MyAccessController
{
    public function __invoke(Request $request): JsonResponse
    {
        Gate::authorize('manageOwnProfile', User::class);

        /** @var User $user */
        $user = $request->user();
        $role = $user->loadMissing('role.permissions')->role;
        $matrix = PermissionMatrix::permissions();

        $permissions = [];
        foreach ($role?->permissions->pluck('code')->all() ?? [] as $code) {
            $code = (string) $code;
            if (isset($matrix[$code])) {
                $permissions[] = ['code' => $code, 'label' => $matrix[$code]['label'], 'description' => $matrix[$code]['description'], 'group' => $matrix[$code]['group'], 'admin' => $matrix[$code]['admin']];
            }
        }
        usort($permissions, fn ($a, $b) => [array_search($a['group'], array_keys(PermissionMatrix::GROUPS), true), $a['label']] <=> [array_search($b['group'], array_keys(PermissionMatrix::GROUPS), true), $b['label']]);

        return response()->json(['data' => [
            'role' => $role === null ? null : ['code' => $role->code, 'name' => $role->name, 'description' => $role->description],
            'permissions' => $permissions,
        ]]);
    }
}

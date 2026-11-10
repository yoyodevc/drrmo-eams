<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Models\Role;
use App\Modules\Access\Support\PermissionMatrix;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** The permission catalog: every code with its label, group and rules. Permissions live in code, so this is read only. */
class PermissionController
{
    public function __invoke(): JsonResponse
    {
        Gate::authorize('manage', Role::class);

        $data = [];
        foreach (PermissionMatrix::permissions() as $code => $def) {
            $data[] = [
                'code' => $code,
                'label' => $def['label'],
                'description' => $def['description'],
                'group' => $def['group'],
                'admin' => $def['admin'],
                'grantable' => $def['grantable'],
            ];
        }

        $groups = [];
        foreach (PermissionMatrix::GROUPS as $key => $label) {
            $groups[] = ['key' => $key, 'label' => $label];
        }

        return response()->json(['data' => $data, 'groups' => $groups]);
    }
}

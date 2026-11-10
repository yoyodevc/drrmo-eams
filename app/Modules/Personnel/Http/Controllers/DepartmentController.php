<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Departments for the people filter and form. Admin editing of departments comes later. */
class DepartmentController
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewPeople', User::class);

        return response()->json(['data' => Department::query()->orderBy('name')->get(['id', 'name'])]);
    }
}

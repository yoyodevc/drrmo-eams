<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Contracts\RoleGuard;
use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Http\Resources\RoleResource;
use App\Modules\Access\Models\Role;
use App\Modules\Personnel\Contracts\PersonRoleChanger;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/** Moves people into a role. Each person has one role, so this also takes them out of their old one. */
class RoleMemberController
{
    public function store(Role $role, Request $request, RoleGuard $guard, PersonRoleChanger $changer): RoleResource
    {
        Gate::authorize('manage', Role::class);

        $request->validate([
            'user_ids' => ['required', 'array', 'min:1', 'max:100'],
            'user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $people = User::query()->with('role.permissions')->whereIn('id', $request->input('user_ids'))->get();

        $problems = [];
        foreach ($people as $person) {
            if ($person->id === $actor->id) {
                $problems[] = 'You cannot change your own role.';
            } elseif ($person->account_status !== AccountStatus::Active) {
                $problems[] = "{$person->name} has not been approved yet.";
            } elseif ($person->role !== null && ! $guard->canHandOut($actor, $person->role)) {
                $problems[] = "You cannot change the role of {$person->name}.";
            }
        }
        abort_unless($guard->canHandOut($actor, $role), 403, 'You cannot give out a role with more access than you have.');

        // Someone must always be left to run the system.
        if (! $role->isAdmin()) {
            $leaving = $people->filter(fn (User $u) => $u->role?->isAdmin())->pluck('id');
            $left = User::query()->whereHas('role', fn ($q) => $q->where('code', RoleCode::Admin->value))
                ->where('account_status', AccountStatus::Active->value)->whereNull('disabled_at')
                ->whereNotIn('id', $leaving)->count();
            if ($leaving->isNotEmpty() && $left === 0) {
                $problems[] = 'At least one admin must remain.';
            }
        }

        if ($problems !== []) {
            throw ValidationException::withMessages(['user_ids' => array_values(array_unique($problems))]);
        }

        DB::transaction(function () use ($people, $role, $changer): void {
            foreach ($people as $person) {
                $changer->change($person, $role);
            }
        });

        return new RoleResource($role->load('permissions')->loadCount('users'));
    }
}

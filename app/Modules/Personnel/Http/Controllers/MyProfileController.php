<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Personnel\Http\Requests\MyProfileRequest;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** A person reads their own profile and edits only their contact number. */
class MyProfileController
{
    public function show(Request $request): JsonResponse
    {
        Gate::authorize('manageOwnProfile', User::class);

        return response()->json(['data' => $this->present($request->user())]);
    }

    public function update(MyProfileRequest $request, AuditLogger $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $before = $user->contact_number;

        $user->forceFill(['contact_number' => $request->validated('contact_number')])->save();

        if ($before !== $user->contact_number) {
            $audit->log('profile.contact_number_changed', $user);
        }

        return response()->json(['data' => $this->present($user)]);
    }

    /** @return array<string, mixed> */
    private function present(User $user): array
    {
        $user->loadMissing(['role', 'department']);

        return [
            'name' => $user->name,
            'email' => $user->email,
            'contact_number' => $user->contact_number,
            'role' => $user->role?->code,
            'role_name' => $user->role?->name,
            'team' => $user->team,
            'team_name' => $user->teamName(),
            'department' => $user->department?->name,
        ];
    }
}

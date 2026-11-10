<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Enums\AvailabilityStatus;
use App\Modules\Personnel\Http\Requests\UpdateVolunteerStatusRequest;
use App\Modules\Personnel\Models\User;
use App\Modules\Personnel\Models\VolunteerStatusLog;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/** Admin screen data: volunteers, their availability, and the history of changes. */
class VolunteerStatusController
{
    /** Approved volunteers. Filter with ?status=active or inactive. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('toggleVolunteers', User::class);

        $query = User::query()
            ->whereHas('role', fn ($q) => $q->where('code', RoleCode::Volunteer->value))
            ->where('account_status', AccountStatus::Active->value);

        $filter = $request->query('status');
        if ($filter !== null && $filter !== '') {
            $status = AvailabilityStatus::tryFrom((string) $filter);
            abort_if($status === null, 422, 'Unknown status filter.');
            $query->where('status', $status->value);
        }

        $rows = $query->orderBy('first_name')->orderBy('last_name')->limit(500)->get();

        return response()->json(['data' => $rows->map(fn (User $u) => $this->present($u))->values()]);
    }

    public function update(UpdateVolunteerStatusRequest $request, User $user, AuditLogger $audit): JsonResponse
    {
        abort_unless($user->roleCode() === RoleCode::Volunteer, 404);

        $new = AvailabilityStatus::from($request->string('status')->toString());
        $reason = trim($request->string('reason')->toString());
        abort_if($user->status === $new, 422, "This volunteer is already {$new->value}.");

        /** @var User $admin */
        $admin = $request->user();
        $old = $user->status;

        DB::transaction(function () use ($user, $admin, $old, $new, $reason, $audit) {
            $user->forceFill(['status' => $new])->save();

            VolunteerStatusLog::query()->create([
                'user_id' => $user->id,
                'old_status' => $old,
                'new_status' => $new,
                'reason' => $reason,
                'changed_by' => $admin->id,
            ]);

            $audit->log('volunteer.status_changed', $user, meta: [
                'before' => ['status' => $old->value],
                'after' => ['status' => $new->value],
                'reason' => $reason,
            ]);
        });

        return response()->json(['data' => $this->present($user->refresh())]);
    }

    public function history(User $user): JsonResponse
    {
        Gate::authorize('toggleVolunteers', User::class);
        abort_unless($user->roleCode() === RoleCode::Volunteer, 404);

        $rows = $user->statusLogs()->with('changedBy:id,first_name,last_name')->latest('id')->limit(200)->get();

        return response()->json(['data' => $rows->map(fn (VolunteerStatusLog $l) => [
            'id' => $l->id,
            'old_status' => $l->old_status->value,
            'new_status' => $l->new_status->value,
            'reason' => $l->reason,
            'changed_by' => $l->changedBy?->name,
            'changed_at' => $l->created_at?->toIso8601String(),
        ])->values()]);
    }

    /** @return array<string, mixed> */
    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status->value,
        ];
    }
}

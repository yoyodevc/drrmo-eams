<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Actions\RegistrationService;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Http\Requests\RejectRegistrationRequest;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Admin screen data: sign up requests, approve and reject. */
class RegistrationReviewController
{
    /** Filter with ?status=pending_approval (default), pending_email, rejected, active (approved) or all. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('reviewRegistrations', User::class);

        $filter = (string) $request->query('status', AccountStatus::PendingApproval->value);

        $query = User::query()
            ->whereHas('role', fn ($q) => $q->where('code', RoleCode::Volunteer->value))
            // Active accounts only count here when an admin approved them through this flow.
            ->where(fn ($q) => $q->where('account_status', '!=', AccountStatus::Active->value)->orWhereNotNull('reviewed_at'));

        // Counts per status for the filter tabs, taken before the status filter.
        $counts = (clone $query)
            ->toBase()
            ->selectRaw('account_status, count(*) as total')
            ->groupBy('account_status')
            ->pluck('total', 'account_status');

        $status = AccountStatus::tryFrom($filter);
        if ($status !== null) {
            $query->where('account_status', $status->value);
        } elseif ($filter !== 'all') {
            abort(422, 'Unknown status filter.');
        }

        $rows = $query->latest('created_at')->latest('id')->limit(200)->get();

        $count = fn (AccountStatus $s): int => (int) ($counts[$s->value] ?? 0);

        return response()->json([
            'data' => $rows->map(fn (User $u) => $this->present($u))->values(),
            'counts' => [
                'pending_approval' => $count(AccountStatus::PendingApproval),
                'pending_email' => $count(AccountStatus::PendingEmail),
                'active' => $count(AccountStatus::Active),
                'rejected' => $count(AccountStatus::Rejected),
                'all' => (int) $counts->sum(),
            ],
        ]);
    }

    public function approve(Request $request, User $user, RegistrationService $registration): JsonResponse
    {
        Gate::authorize('reviewRegistrations', User::class);
        $this->ensurePending($user);

        $registration->approve($user, $request->user());

        return response()->json(['data' => $this->present($user->refresh())]);
    }

    public function reject(RejectRegistrationRequest $request, User $user, RegistrationService $registration): JsonResponse
    {
        $this->ensurePending($user);

        $registration->reject($user, $request->user(), $request->string('reason')->toString());

        return response()->json(['data' => $this->present($user->refresh())]);
    }

    private function ensurePending(User $user): void
    {
        abort_unless(
            $user->account_status === AccountStatus::PendingApproval,
            409,
            'This request was already handled or the email is not confirmed yet.',
        );
    }

    /** @return array<string, mixed> */
    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'name' => $user->name,
            'email' => $user->email,
            'account_status' => $user->account_status->value,
            'requested_at' => $user->created_at?->toIso8601String(),
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'reviewed_at' => $user->reviewed_at?->toIso8601String(),
            'rejection_reason' => $user->rejection_reason,
        ];
    }
}

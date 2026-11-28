<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Controllers;

use App\Modules\Access\Enums\Role;
use App\Modules\Monitoring\Models\ReportReviewer;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use App\Support\PublicCode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Settings: who the 2 global reviewer marshals are. Admin only (`access.manage`). They read every
 * site report and every emergency, and get the alerts, for every event.
 */
class ReportReviewerController
{
    public function show(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json(['data' => $this->payload()]);
    }

    public function update(Request $request, AuditLogger $audit): JsonResponse
    {
        $this->authorizeAdmin($request);
        $request->merge(['user_ids' => PublicCode::toIds(User::class, $request->input('user_ids'))]);
        $data = $request->validate([
            'user_ids' => ['present', 'array', 'max:'.ReportReviewer::MAX],
            'user_ids.*' => ['integer', 'distinct'],
        ]);
        $ids = array_values(array_map('intval', $data['user_ids']));

        // Only active marshals can be picked.
        $valid = $this->marshals()->whereIn('id', $ids)->pluck('id')->all();
        abort_if(count($valid) !== count($ids), 422, 'Only active marshals can be reviewers.');

        $before = ReportReviewer::query()->pluck('user_id')->all();
        DB::transaction(function () use ($ids, $request): void {
            ReportReviewer::query()->whereNotIn('user_id', $ids)->delete();
            foreach ($ids as $id) {
                ReportReviewer::query()->firstOrCreate(['user_id' => $id], ['assigned_by' => $request->user()?->id]);
            }
        });
        $audit->log('report_reviewers.changed', 'report_reviewers', null, ['before' => $before, 'after' => $ids]);

        return response()->json(['data' => $this->payload()]);
    }

    /** @return Builder<User> */
    private function marshals()
    {
        return User::query()->where('account_status', 'active')->whereNull('disabled_at')
            ->whereHas('role', fn ($q) => $q->where('code', Role::Marshal->value));
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        $selected = ReportReviewer::query()->pluck('user_id')->all();
        $codes = User::query()->whereIn('id', $selected)->pluck('public_code', 'id');

        return [
            'max' => ReportReviewer::MAX,
            // In the order they were picked.
            'user_ids' => array_values(array_filter(array_map(fn ($id) => $codes[$id] ?? null, $selected))),
            'candidates' => $this->marshals()->orderBy('first_name')->orderBy('last_name')->get()
                ->map(fn (User $u) => ['id' => $u->public_code, 'name' => $u->name, 'email' => $u->email])->values()->all(),
        ];
    }

    private function authorizeAdmin(Request $request): void
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->hasPermission('access.manage'), 403);
    }
}

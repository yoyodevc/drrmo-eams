<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Controllers;

use App\Modules\Monitoring\Enums\ReportStatus;
use App\Modules\Monitoring\Http\Requests\SubmitReportRequest;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The reporter's own slots and the report form (S4.6). Never takes a user id from the request. */
class ReportSlotController
{
    /** Own slots from yesterday on, oldest first, so open ones are easy to find. */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $slots = SiteReport::query()
            ->whereHas('assignment', fn ($q) => $q->where('user_id', $user->id))
            ->where('due_at', '>=', now()->subDay())
            ->with('assignment.event:id,title')
            ->orderBy('due_at')
            ->get()
            // The grant can end or be revoked after the slot was made.
            ->filter(fn (SiteReport $r) => Gate::forUser($user)->allows('submit', $r))
            ->values();

        return response()->json(['data' => $slots->map(fn (SiteReport $r) => self::row($r))]);
    }

    /** Saves the report. Sending the same slot twice returns the report already saved. */
    public function submit(SubmitReportRequest $request, SiteReport $report, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('submit', $report);

        $saved = DB::transaction(function () use ($request, $report, $audit): SiteReport {
            // Lock the row so two taps at once cannot both save.
            $locked = SiteReport::query()->whereKey($report->id)->lockForUpdate()->firstOrFail();
            if (! $locked->isOpen()) {
                return $locked;
            }

            $photo = $request->file('photo');
            $path = $photo?->store('reports', 'local');
            $now = now();
            $onTime = $locked->status === ReportStatus::Pending
                && $now->lte($locked->due_at->copy()->addMinutes(SiteReport::OVERDUE_AFTER_MINUTES));

            $locked->update([
                'summary' => $request->validated('summary'),
                'photo_path' => $path === false ? null : $path,
                'photo_name' => $photo?->getClientOriginalName(),
                'status' => $onTime ? ReportStatus::Submitted : ReportStatus::Late,
                'submitted_at' => $now,
            ]);
            $audit->log('report.submitted', $locked, meta: ['event_id' => $locked->assignment->event_id, 'status' => $locked->status->value, 'has_photo' => $path !== null]);

            return $locked;
        });

        return response()->json(['data' => self::row($saved->load('assignment.event:id,title'))]);
    }

    /** The reporter may look at the photo they sent. */
    public function photo(SiteReport $report): StreamedResponse
    {
        Gate::authorize('submit', $report);
        abort_if($report->photo_path === null || ! Storage::disk('local')->exists($report->photo_path), 404);

        return Storage::disk('local')->response($report->photo_path);
    }

    /** @return array<string, mixed> */
    public static function row(SiteReport $r): array
    {
        return [
            'id' => $r->id,
            'assignment_id' => $r->assignment_id,
            'event' => $r->assignment->event->title ?? null,
            'due_at' => $r->due_at->toIso8601String(),
            'status' => $r->status->value,
            'summary' => $r->summary,
            'has_photo' => $r->photo_path !== null,
            'submitted_at' => $r->submitted_at?->toIso8601String(),
        ];
    }
}

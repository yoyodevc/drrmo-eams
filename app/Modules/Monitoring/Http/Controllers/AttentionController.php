<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Controllers;

use App\Modules\Events\Models\Event;
use App\Modules\Monitoring\Enums\EmergencyStatus;
use App\Modules\Monitoring\Enums\ReportStatus;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * The "needs attention" view for admins and reviewers: open emergencies first, then overdue and missed
 * reports, then a small summary for each event (on time, late, overdue, missed). A person sees only what
 * their `reports.view` covers. Emergencies need the global reviewer role or a global `reports.view`.
 */
class AttentionController
{
    public function index(Request $request, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('viewAny', SiteReport::class);
        /** @var User $user */
        $user = $request->user();

        $emergencies = collect();
        if (Gate::forUser($user)->allows('viewAny', EmergencyReport::class)) {
            $emergencies = EmergencyReport::query()->with(['event:id,title', 'reporter:id,first_name,last_name', 'acknowledger:id,first_name,last_name'])
                ->where('status', '!=', EmergencyStatus::Resolved->value)
                ->orderByRaw("status = 'sent' desc")->orderByDesc('id')->limit(50)->get();
        }

        $scoped = $this->scoped($user);
        $problems = (clone $scoped)->with(['assignment.user:id,first_name,last_name', 'assignment.event:id,title'])
            ->whereIn('status', [ReportStatus::Overdue->value, ReportStatus::Missed->value])
            ->orderByRaw("status = 'overdue' desc")->orderByDesc('due_at')->limit(50)->get();

        $audit->log('attention.viewed', 'site_report', null, ['emergencies' => $emergencies->count(), 'reports' => $problems->count()]);

        return response()->json(['data' => [
            'emergencies' => $emergencies->map(fn (EmergencyReport $e) => [
                'id' => $e->id,
                'type' => $e->type->value,
                'status' => $e->status->value,
                'escalated' => $e->escalated_at !== null,
                'sent_at' => $e->created_at->toIso8601String(),
                'event' => $e->event->title ?? null,
                'reporter' => $e->reporter->name ?? null,
                'acknowledged_by' => $e->acknowledger->name ?? null,
            ])->values(),
            'reports' => $problems->map(fn (SiteReport $r) => [
                'id' => $r->id,
                'status' => $r->status->value,
                'due_at' => $r->due_at->toIso8601String(),
                'event' => $r->assignment->event->title ?? null,
                'author' => $r->assignment->user->name ?? null,
            ])->values(),
            'events' => $this->eventSummary($scoped),
        ]]);
    }

    /**
     * Counts of due slots for each event. A slot not yet due is left out, as in the feed.
     *
     * @param  Builder<SiteReport>  $scoped
     * @return list<array<string, mixed>>
     */
    private function eventSummary(Builder $scoped): array
    {
        $rows = (clone $scoped)->join('assignments', 'assignments.id', '=', 'site_reports.assignment_id')
            ->where('site_reports.due_at', '<=', now())
            ->groupBy('assignments.event_id', 'site_reports.status')
            ->select('assignments.event_id', 'site_reports.status', DB::raw('count(*) as total'))
            ->get();

        $titles = Event::query()->whereIn('id', $rows->pluck('event_id')->unique())->pluck('title', 'id');

        return $rows->groupBy('event_id')->map(function ($group, $eventId) use ($titles): array {
            $count = fn (string $status): int => (int) ($group->firstWhere('status', $status)->total ?? 0);

            return [
                'event_id' => (int) $eventId,
                'event' => $titles[$eventId] ?? null,
                'on_time' => $count('submitted'),
                'late' => $count('late'),
                'overdue' => $count('overdue'),
                'missed' => $count('missed'),
            ];
        })->sortBy('event')->values()->all();
    }

    /** @return Builder<SiteReport> */
    private function scoped(User $user): Builder
    {
        $query = SiteReport::query();
        if ($user->hasPermission('reports.view')) {
            return $query;
        }

        $eventIds = $user->activeGrants()->get()
            ->filter(fn ($g) => $g->permission->code === 'reports.view' && $g->event_id !== null)
            ->pluck('event_id');

        return $query->whereHas('assignment', fn ($q) => $q->whereIn('event_id', $eventIds));
    }
}

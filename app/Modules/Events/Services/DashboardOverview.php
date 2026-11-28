<?php

declare(strict_types=1);

namespace App\Modules\Events\Services;

use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\Event;
use App\Modules\Information\Models\Memo;
use App\Modules\Information\Models\Message;
use App\Modules\Monitoring\Enums\EmergencyStatus;
use App\Modules\Monitoring\Enums\ReportStatus;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * The read-only extras on the admin dashboard: figures from the finished modules and the statistics
 * cards. Each block is left out when the person's permissions do not cover it.
 */
class DashboardOverview
{
    private const TIMEZONE = 'Asia/Manila';

    /** Minutes after shift start before a started duty counts as late. Same as the dashboard's "late" list. */
    private const LATE_AFTER_MINUTES = 30;

    /** @return array<string, mixed> */
    public function for(User $user): array
    {
        $out = ['stats' => $this->stats()];

        if (Gate::forUser($user)->allows('viewAny', EmergencyReport::class)) {
            $out['emergencies'] = [
                'waiting' => EmergencyReport::query()->where('status', EmergencyStatus::Sent->value)->count(),
                'open' => EmergencyReport::query()->where('status', '!=', EmergencyStatus::Resolved->value)->count(),
            ];
        }
        if (Gate::forUser($user)->allows('viewAny', SiteReport::class) && $user->hasPermission('reports.view')) {
            $out['reports'] = [
                'overdue' => SiteReport::query()->where('status', ReportStatus::Overdue->value)->count(),
                'missed' => SiteReport::query()->where('status', ReportStatus::Missed->value)->count(),
            ];
        }
        if ($user->hasPermission('messages.office_inbox')) {
            $out['messages'] = ['unread' => Message::query()->unreadByOffice()->count()];
        }
        if (Gate::forUser($user)->allows('viewAny', Memo::class)) {
            $out['memos'] = [
                'recent' => Memo::query()->orderByDesc('posted_at')->limit(3)->get(['id', 'public_code', 'title', 'category', 'posted_at'])
                    ->map(fn (Memo $m) => ['id' => $m->public_code, 'title' => $m->title, 'category' => $m->category->label(), 'posted_at' => $m->posted_at->toIso8601String()])
                    ->values(),
                'this_week' => Memo::query()->where('posted_at', '>=', now()->subDays(7))->count(),
            ];
        }
        if ($user->hasPermission('people.view')) {
            $out['people'] = [
                'active' => User::query()->where('account_status', AccountStatus::Active->value)->count(),
            ];
        }
        if ($user->hasPermission('registrations.review')) {
            $out['requests'] = ['pending' => User::query()->where('account_status', AccountStatus::PendingApproval->value)->count()];
        }

        return $out;
    }

    /** @return array<string, mixed> */
    private function stats(): array
    {
        $now = now(self::TIMEZONE);

        // Attendance: this month's shifts, by how the person turned up.
        $monthStart = $now->copy()->startOfMonth();
        $monthShifts = Assignment::query()->with('requirement:id,shift_starts_at')
            ->whereIn('status', [AssignmentStatus::OnDuty->value, AssignmentStatus::Completed->value, AssignmentStatus::NoShow->value])
            ->whereHas('requirement', fn ($q) => $q->where('shift_starts_at', '>=', $monthStart->copy()->utc())->where('shift_starts_at', '<=', now()))
            ->get();
        $noShow = $monthShifts->where('status', AssignmentStatus::NoShow)->count();
        $late = $monthShifts->filter(fn (Assignment $a) => $a->status !== AssignmentStatus::NoShow && $a->duty_started_at !== null
            && $a->requirement !== null
            && $a->duty_started_at->gt($a->requirement->shift_starts_at->copy()->addMinutes(self::LATE_AFTER_MINUTES)))->count();
        $total = $monthShifts->count();
        $onTime = $total - $noShow - $late;

        // Duty hours: finished duties, one bar for each of the last 8 weeks (Monday start).
        $weeks = [];
        for ($i = 7; $i >= 0; $i--) {
            $weeks[] = $now->copy()->startOfWeek()->subWeeks($i);
        }
        $finished = Assignment::query()->whereNotNull('duty_started_at')->whereNotNull('duty_ended_at')
            ->where('duty_started_at', '>=', $weeks[0]->copy()->utc())->get(['duty_started_at', 'duty_ended_at']);
        $hours = array_map(function ($start) use ($finished): array {
            $end = $start->copy()->addWeek();
            $sum = $finished->filter(fn (Assignment $a) => $a->duty_started_at->gte($start) && $a->duty_started_at->lt($end))
                ->sum(fn (Assignment $a) => $a->duty_started_at->diffInMinutes($a->duty_ended_at, true)) / 60;

            return ['week' => $start->toDateString(), 'hours' => round($sum, 1)];
        }, $weeks);

        // Time to acknowledge: median hours from assignment to acknowledgement, 5 weekly points over 30 days.
        $acked = Assignment::query()->whereNotNull('acknowledged_at')->where('created_at', '>=', now()->subDays(35))
            ->get(['created_at', 'acknowledged_at']);
        $median = function ($rows): ?float {
            $v = $rows->map(fn (Assignment $a) => $a->created_at->diffInMinutes($a->acknowledged_at, true) / 60)->sort()->values();
            if ($v->isEmpty()) {
                return null;
            }
            $mid = intdiv($v->count(), 2);

            return round($v->count() % 2 ? $v[$mid] : ($v[$mid - 1] + $v[$mid]) / 2, 1);
        };
        $last30 = $acked->filter(fn (Assignment $a) => $a->created_at->gte(now()->subDays(30)));
        $trend = [];
        for ($i = 4; $i >= 0; $i--) {
            $from = now()->subDays(($i + 1) * 7);
            $to = now()->subDays($i * 7);
            $trend[] = $median($acked->filter(fn (Assignment $a) => $a->created_at->gte($from) && $a->created_at->lt($to)));
        }

        // Events by type: published events in the last 6 months.
        $byType = Event::query()->with('type:code,name')->where('status', 'published')
            ->where('starts_at', '>=', now()->subMonths(6))->get(['id', 'event_type'])
            ->groupBy(fn (Event $e) => $e->typeLabel())->map->count()->sortDesc()->take(5);

        return [
            'attendance' => ['month' => $monthStart->format('F'), 'total' => $total, 'on_time' => $onTime, 'late' => $late, 'no_show' => $noShow],
            'duty_hours' => ['weeks' => $hours, 'total' => round(array_sum(array_column($hours, 'hours')), 1)],
            'acknowledge' => ['median_hours' => $median($last30), 'trend' => $trend],
            'events_by_type' => ['total' => $byType->sum(), 'types' => $byType->map(fn ($n, $name) => ['name' => $name, 'count' => $n])->values()],
        ];
    }
}

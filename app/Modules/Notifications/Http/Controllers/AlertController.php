<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Monitoring\Enums\EmergencyStatus;
use App\Modules\Monitoring\Enums\ReportStatus;
use App\Modules\Notifications\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The signed in person's in app alerts (channel in_app). Always their own rows. */
class AlertController
{
    /** Unread first, then newest, at most 30. */
    public function index(Request $request): JsonResponse
    {
        $rows = Notification::query()->with(['subject:id,first_name,last_name', 'siteReport', 'emergencyReport', 'assignment.event:id,title'])
            ->where('user_id', $request->user()?->id)->where('channel', 'in_app')
            ->orderByRaw('read_at is null desc')->orderByDesc('id')->limit(30)->get()
            // A reminder is only worth showing while the report can still be filled.
            // An emergency alert is only worth showing until someone has acknowledged it.
            ->reject(fn (Notification $n) => $n->emergency_report_id !== null && $n->emergencyReport?->status !== EmergencyStatus::Sent)
            ->reject(fn (Notification $n) => in_array($n->type, ['report.reminder', 'report.due'], true)
                && ($n->siteReport === null || ! in_array($n->siteReport->status, [ReportStatus::Pending, ReportStatus::Overdue], true)));

        return response()->json([
            'data' => $rows->map(fn (Notification $n) => [
                'id' => $n->public_code,
                'type' => $n->type,
                'emergency_report_id' => $n->emergencyReport?->public_code,
                'site_report_id' => $n->siteReport?->public_code,
                'about' => $n->subject->name ?? null,
                'event' => $n->assignment?->event->title,
                'due_at' => $n->siteReport?->due_at->toIso8601String(),
                'created_at' => $n->created_at->toIso8601String(),
                'read' => $n->read_at !== null,
            ])->values(),
            'unread' => $rows->filter(fn (Notification $n) => $n->read_at === null)->count(),
        ]);
    }

    /** Marks all of the person's alerts read. */
    public function read(Request $request): JsonResponse
    {
        Notification::query()->where('user_id', $request->user()?->id)->where('channel', 'in_app')->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['data' => ['unread' => 0]]);
    }
}

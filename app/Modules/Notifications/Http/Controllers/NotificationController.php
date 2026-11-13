<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Records\Contracts\AuditLogger;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Admin log of every notification email, with a Retry for failed ones. */
class NotificationController
{
    /** Dates are stored in UTC and the "day" is a Manila day (PROJECT_PLAN A8). */
    private const TIMEZONE = 'Asia/Manila';

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Notification::class);
        $f = $request->validate([
            'type' => ['nullable', Rule::enum(NotificationType::class)],
            'status' => ['nullable', Rule::in(['queued', 'sent', 'failed'])],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $query = Notification::query()->with(['user:id,first_name,last_name,email', 'subject:id,first_name,last_name', 'assignment.event:id,title']);
        if (! empty($f['type'])) {
            $query->where('type', $f['type']);
        }
        if (! empty($f['status'])) {
            $query->where('status', $f['status']);
        }
        if (! empty($f['from'])) {
            $query->where('created_at', '>=', Carbon::parse($f['from'], self::TIMEZONE)->startOfDay()->utc());
        }
        if (! empty($f['to'])) {
            $query->where('created_at', '<', Carbon::parse($f['to'], self::TIMEZONE)->addDay()->startOfDay()->utc());
        }
        if (! empty($f['search'])) {
            $like = '%'.addcslashes($f['search'], '%_\\').'%';
            $query->whereHas('user', fn ($q) => $q->where('email', 'like', $like)
                ->orWhere('first_name', 'like', $like)->orWhere('last_name', 'like', $like));
        }

        $page = $query->orderByDesc('id')->paginate(25);
        $start = now(self::TIMEZONE)->startOfDay()->utc();

        return response()->json([
            'data' => $page->getCollection()->map(fn (Notification $n) => $this->row($n))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'summary' => [
                'sent_today' => Notification::query()->where('status', 'sent')->where('sent_at', '>=', $start)->count(),
                'daily_limit' => (int) config('mail.daily_limit'),
            ],
        ]);
    }

    /** The signed-in person's own sent emails, newest first. Failed and queued ones stay admin only. */
    public function mine(Request $request): JsonResponse
    {
        $rows = Notification::query()->with('assignment.event:id,title')
            ->where('user_id', $request->user()?->id)->where('status', 'sent')
            ->orderByDesc('sent_at')->limit(50)->get();

        return response()->json(['data' => $rows->map(fn (Notification $n) => [
            'id' => $n->id,
            'type' => $n->type,
            'sent_at' => $n->sent_at?->toIso8601String(),
            'event' => $n->assignment?->event->title,
            'assignment_id' => $n->assignment_id,
        ])->values()]);
    }

    public function retry(Notification $notification, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('retry', Notification::class);
        abort_unless($notification->status === 'failed', 422, 'Only failed notifications can be retried.');

        $notification->update(['status' => 'queued', 'last_error' => null]);
        SendNotificationEmail::dispatch($notification);
        $audit->log('notification.retried', $notification);

        return response()->json(['data' => $this->row($notification->fresh(['user', 'subject', 'assignment.event']) ?? $notification)]);
    }

    /** @return array<string, mixed> */
    private function row(Notification $n): array
    {
        return [
            'id' => $n->id,
            'type' => $n->type,
            'status' => $n->status,
            'attempts' => $n->attempts,
            'last_error' => $n->last_error,
            'created_at' => $n->created_at->toIso8601String(),
            'sent_at' => $n->sent_at?->toIso8601String(),
            'recipient' => $n->user === null ? null : ['name' => $n->user->name, 'email' => $n->user->email],
            'event' => $n->assignment?->event->title,
            'about' => $n->subject?->name,
        ];
    }
}

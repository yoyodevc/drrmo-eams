<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The signed in person's in app alerts (channel in_app). Always their own rows. */
class AlertController
{
    /** Unread first, then newest, at most 30. */
    public function index(Request $request): JsonResponse
    {
        $rows = Notification::query()->with('subject:id,first_name,last_name')
            ->where('user_id', $request->user()?->id)->where('channel', 'in_app')
            ->orderByRaw('read_at is null desc')->orderByDesc('id')->limit(30)->get();

        return response()->json([
            'data' => $rows->map(fn (Notification $n) => [
                'id' => $n->id,
                'type' => $n->type,
                'emergency_report_id' => $n->emergency_report_id,
                'about' => $n->subject->name ?? null,
                'created_at' => $n->created_at->toIso8601String(),
                'read' => $n->read_at !== null,
            ])->values(),
            'unread' => Notification::query()->where('user_id', $request->user()?->id)->where('channel', 'in_app')->whereNull('read_at')->count(),
        ]);
    }

    /** Marks all of the person's alerts read. */
    public function read(Request $request): JsonResponse
    {
        Notification::query()->where('user_id', $request->user()?->id)->where('channel', 'in_app')->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['data' => ['unread' => 0]]);
    }
}

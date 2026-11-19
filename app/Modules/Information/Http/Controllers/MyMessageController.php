<?php

declare(strict_types=1);

namespace App\Modules\Information\Http\Controllers;

use App\Modules\Information\Http\Requests\SendMessageRequest;
use App\Modules\Information\Models\Message;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** A person's own conversation with the DRRMO office (S5.4). It is always scoped to the signed in user. */
class MyMessageController
{
    private const LIMIT = 200;

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);
        $me = $this->me($request);

        // The newest 200, shown oldest first so the newest sits at the bottom.
        $messages = Message::query()->conversationOf($me->id)
            ->orderByDesc('sent_at')->orderByDesc('id')->limit(self::LIMIT)->get()->reverse()->values();

        return response()->json([
            'data' => $messages->map(fn (Message $m) => $this->row($m))->values(),
            'unread' => Message::query()->unreadFor($me->id)->count(),
        ]);
    }

    public function store(SendMessageRequest $request): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);
        $me = $this->me($request);

        $message = Message::query()->create([
            'sender_id' => $me->id,
            'recipient_id' => null,
            'body' => $request->validated('body'),
            'sent_at' => now(),
        ]);

        return response()->json(['data' => $this->row($message)], 201);
    }

    /** Opening the conversation marks the office's answers as read. */
    public function read(Request $request): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);

        Message::query()->unreadFor($this->me($request)->id)->update(['read_at' => now()]);

        return response()->json(['unread' => 0]);
    }

    /** The number for the Messages tab. Light, because the page polls it every minute. */
    public function unread(Request $request): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);

        return response()->json(['unread' => Message::query()->unreadFor($this->me($request)->id)->count()]);
    }

    private function me(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /** @return array<string, mixed> */
    private function row(Message $m): array
    {
        $fromOffice = $m->recipient_id !== null;

        return [
            'id' => $m->id,
            'body' => $m->body,
            'sent_at' => $m->sent_at->toIso8601String(),
            'from_office' => $fromOffice,
            // The person sees the office, not which admin answered.
            'sender' => $fromOffice ? 'DRRMO' : 'You',
        ];
    }
}

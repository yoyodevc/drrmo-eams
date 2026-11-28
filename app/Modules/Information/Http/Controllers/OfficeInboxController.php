<?php

declare(strict_types=1);

namespace App\Modules\Information\Http\Controllers;

use App\Modules\Information\Http\Requests\SendMessageRequest;
use App\Modules\Information\Models\Message;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * The DRRMO inbox (S5.4). Everyone with `messages.office_inbox` reads every conversation and answers it.
 * One conversation per person, so the list is people, newest activity first.
 */
class OfficeInboxController
{
    private const LIMIT = 200;

    public function index(): JsonResponse
    {
        Gate::authorize('office', Message::class);

        // The person of a message is its sender when it goes to the office, and its recipient when it is an answer.
        $rows = Message::query()->toBase()->where('is_direct', false)
            ->selectRaw('coalesce(recipient_id, sender_id) as person_id, max(id) as last_id')
            ->selectRaw('sum(case when recipient_id is null and read_at is null then 1 else 0 end) as unread')
            ->groupBy(DB::raw('coalesce(recipient_id, sender_id)'))
            ->orderByDesc('last_id')->limit(self::LIMIT)->get();

        $people = User::query()->whereIn('id', $rows->pluck('person_id'))->get(['id', 'public_code', 'first_name', 'last_name'])->keyBy('id');
        $last = Message::query()->whereIn('id', $rows->pluck('last_id'))->get()->keyBy('id');

        return response()->json([
            'data' => $rows->map(function ($r) use ($people, $last) {
                $m = $last[$r->last_id];

                return [
                    'person' => ['id' => $people[$r->person_id]->public_code ?? null, 'name' => $people[$r->person_id]->name ?? 'Unknown'],
                    'last' => ['body' => $m->body, 'sent_at' => $m->sent_at->toIso8601String(), 'from_office' => $m->recipient_id !== null],
                    'unread' => (int) $r->unread,
                ];
            })->values(),
            'unread' => (int) $rows->sum('unread'),
        ]);
    }

    public function show(User $user): JsonResponse
    {
        Gate::authorize('office', Message::class);

        return response()->json([
            'person' => ['id' => $user->public_code, 'name' => $user->name],
            'data' => $this->thread($user)->map(fn (Message $m) => $this->row($m))->values(),
        ]);
    }

    public function reply(SendMessageRequest $request, User $user): JsonResponse
    {
        Gate::authorize('office', Message::class);
        // Answers only: a conversation starts when the person writes first.
        abort_unless(Message::query()->conversationOf($user->id)->exists(), 404);

        $message = Message::query()->create([
            'sender_id' => $request->user()?->getAuthIdentifier(),
            'recipient_id' => $user->id,
            'body' => $request->validated('body'),
            'sent_at' => now(),
        ]);

        return response()->json(['data' => $this->row($message->load('sender:id,first_name,last_name'))], 201);
    }

    /** Opening a conversation marks what the person wrote as read, for every admin. */
    public function read(User $user): JsonResponse
    {
        Gate::authorize('office', Message::class);

        Message::query()->unreadByOffice()->where('sender_id', $user->id)->update(['read_at' => now()]);

        return response()->json(['unread' => Message::query()->unreadByOffice()->count()]);
    }

    /** The number for the sidebar. Light, because the page polls it every minute. */
    public function unread(): JsonResponse
    {
        Gate::authorize('office', Message::class);

        return response()->json(['unread' => Message::query()->unreadByOffice()->count()]);
    }

    /** @return Collection<int, Message> */
    private function thread(User $person): Collection
    {
        return Message::query()->conversationOf($person->id)->with('sender:id,first_name,last_name')
            ->orderByDesc('sent_at')->orderByDesc('id')->limit(self::LIMIT)->get()->reverse()->values();
    }

    /** @return array<string, mixed> */
    private function row(Message $m): array
    {
        return [
            'id' => $m->id,
            'body' => $m->body,
            'sent_at' => $m->sent_at->toIso8601String(),
            'from_office' => $m->recipient_id !== null,
            // Admins see which admin answered.
            'sender' => $m->sender->name ?? 'Unknown',
            // For the office's answers: the person has opened them since.
            'seen' => $m->recipient_id !== null && $m->read_at !== null,
        ];
    }
}

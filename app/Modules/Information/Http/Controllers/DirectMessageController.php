<?php

declare(strict_types=1);

namespace App\Modules\Information\Http\Controllers;

use App\Modules\Information\Http\Requests\SendMessageRequest;
use App\Modules\Information\Models\Message;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Person-to-person messages (S5.4). Everyone with `messages.use` can write to any other active
 * person. A person only ever reads conversations they are part of. The people list shows names
 * only: no email, phone or location.
 */
class DirectMessageController
{
    private const LIMIT = 200;

    private const PEOPLE_LIMIT = 20;

    /** My conversations with other people, newest activity first. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);
        $me = $this->me($request)->id;

        // $me is an integer from the session, so it is safe to put in the SQL. A bound value would not
        // match the GROUP BY expression under ONLY_FULL_GROUP_BY.
        $other = 'case when sender_id = '.$me.' then recipient_id else sender_id end';

        $rows = Message::query()->toBase()->where('is_direct', true)
            ->where(fn ($q) => $q->where('sender_id', $me)->orWhere('recipient_id', $me))
            ->selectRaw($other.' as person_id')
            ->selectRaw('max(id) as last_id')
            ->selectRaw('sum(case when recipient_id = ? and read_at is null then 1 else 0 end) as unread', [$me])
            ->groupBy(DB::raw($other))
            ->orderByDesc('last_id')->limit(self::LIMIT)->get();

        $people = User::query()->whereIn('id', $rows->pluck('person_id'))->get(['id', 'first_name', 'last_name'])->keyBy('id');
        $last = Message::query()->whereIn('id', $rows->pluck('last_id'))->get()->keyBy('id');

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'person' => ['id' => (int) $r->person_id, 'name' => $people[$r->person_id]->name ?? 'Unknown'],
                'last' => [
                    'body' => $last[$r->last_id]->body,
                    'sent_at' => $last[$r->last_id]->sent_at->toIso8601String(),
                    'mine' => $last[$r->last_id]->sender_id === $me,
                ],
                'unread' => (int) $r->unread,
            ])->values(),
            'unread' => (int) $rows->sum('unread'),
        ]);
    }

    /** Find someone to write to. Active people only, by name, never the caller. */
    public function people(Request $request): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);
        $q = addcslashes(trim((string) $request->query('q', '')), '%_\\');

        $users = User::query()
            ->where('account_status', AccountStatus::Active)->whereNull('disabled_at')
            ->whereKeyNot($this->me($request)->id)
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w
                ->where('first_name', 'like', '%'.$q.'%')
                ->orWhere('last_name', 'like', '%'.$q.'%')))
            ->orderBy('first_name')->orderBy('last_name')->limit(self::PEOPLE_LIMIT)
            ->get(['id', 'first_name', 'last_name']);

        return response()->json(['data' => $users->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values()]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);
        $me = $this->me($request)->id;

        $messages = Message::query()->between($me, $user->id)
            ->orderByDesc('sent_at')->orderByDesc('id')->limit(self::LIMIT)->get()->reverse()->values();

        return response()->json([
            'person' => ['id' => $user->id, 'name' => $user->name],
            'data' => $messages->map(fn (Message $m) => $this->row($m, $me, $user))->values(),
        ]);
    }

    public function store(SendMessageRequest $request, User $user): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);
        $me = $this->me($request);
        abort_if($user->id === $me->id, 422, 'You cannot message yourself.');
        // Closed or waiting accounts cannot read it, so do not accept it.
        abort_unless($user->canSignIn(), 422, 'This person cannot receive messages.');

        $message = Message::query()->create([
            'sender_id' => $me->id,
            'recipient_id' => $user->id,
            'is_direct' => true,
            'body' => $request->validated('body'),
            'sent_at' => now(),
        ]);

        return response()->json(['data' => $this->row($message, $me->id, $user)], 201);
    }

    /** Opening a conversation marks what the other person wrote as read. */
    public function read(Request $request, User $user): JsonResponse
    {
        Gate::authorize('useOwn', Message::class);
        $me = $this->me($request)->id;

        Message::query()->directUnreadFor($me)->where('sender_id', $user->id)->update(['read_at' => now()]);

        return response()->json(['unread' => Message::query()->directUnreadFor($me)->count()]);
    }

    private function me(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /** @return array<string, mixed> */
    private function row(Message $m, int $me, User $other): array
    {
        $mine = $m->sender_id === $me;

        return [
            'id' => $m->id,
            'body' => $m->body,
            'sent_at' => $m->sent_at->toIso8601String(),
            'from_office' => false,
            'mine' => $mine,
            'sender' => $mine ? 'You' : $other->name,
            // For your own messages: the other person has opened them since.
            'seen' => $mine && $m->read_at !== null,
        ];
    }
}

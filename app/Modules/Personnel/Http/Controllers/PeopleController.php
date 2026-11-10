<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Access\Models\Role;
use App\Modules\Personnel\Actions\PersonInviter;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Enums\AvailabilityStatus;
use App\Modules\Personnel\Models\Team;
use App\Modules\Personnel\Http\Requests\PersonRequest;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/** Admin people list, profile, create and edit. Pending sign ups stay on the Access requests screen. */
class PeopleController
{
    public const PER_PAGE = 25;

    /** Filters: role, team, status (availability), department, search (name or email). */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewPeople', User::class);

        $query = User::query()->with(['role', 'department'])
            ->where('account_status', AccountStatus::Active->value);

        if (($role = $this->filter($request, 'role')) !== null) {
            abort_unless(Role::query()->where('code', $role)->exists(), 422, 'Unknown role filter.');
            $query->whereHas('role', fn ($q) => $q->where('code', $role));
        }
        if (($team = $this->filter($request, 'team')) !== null) {
            abort_unless(Team::query()->where('code', $team)->exists(), 422, 'Unknown team filter.');
            $query->where('team', $team);
        }
        if (($status = $this->filter($request, 'status')) !== null) {
            abort_if(AvailabilityStatus::tryFrom($status) === null, 422, 'Unknown status filter.');
            $query->where('status', $status);
        }
        if (($department = $this->filter($request, 'department')) !== null) {
            abort_unless(ctype_digit($department), 422, 'Unknown department filter.');
            $query->where('department_id', (int) $department);
        }
        if (($search = $this->filter($request, 'search')) !== null) {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $query->where(fn ($q) => $q
                ->where('first_name', 'like', $like)
                ->orWhere('last_name', 'like', $like)
                ->orWhere('email', 'like', $like)
                ->orWhereRaw("concat(first_name, ' ', last_name) like ?", [$like]));
        }

        $page = $query->orderBy('first_name')->orderBy('last_name')->orderBy('id')->paginate(self::PER_PAGE);

        return response()->json([
            'data' => collect($page->items())->map(fn (User $u) => $this->present($u))->values(),
            'meta' => ['page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    public function show(User $user): JsonResponse
    {
        Gate::authorize('viewPeople', User::class);

        return response()->json(['data' => $this->present($user->loadMissing(['role', 'department']))]);
    }

    public function store(PersonRequest $request, AuditLogger $audit, PersonInviter $inviter): JsonResponse
    {
        $data = $request->validated();

        $user = DB::transaction(function () use ($data, $audit): User {
            $user = new User(Arr::only($data, ['first_name', 'last_name', 'email', 'contact_number', 'department_id', 'team']));
            $user->role_id = $this->roleId($data['role']);
            // Nobody knows this password. The person picks their own from the emailed link.
            $user->password = Str::random(48);
            $user->account_status = AccountStatus::Active;
            $user->email_verified_at = now();
            $user->save();

            $audit->log('person.created', $user, meta: ['after' => $this->snapshot($user)]);

            return $user;
        });

        $sent = $inviter->send($user);

        return response()->json(['data' => $this->present($user->refresh()->load(['role', 'department'])), 'invite_sent' => $sent], 201);
    }

    public function update(PersonRequest $request, User $user, AuditLogger $audit): JsonResponse
    {
        $data = $request->validated();
        // Nobody changes their own role, so an admin cannot lock themselves or the office out.
        abort_if($user->id === $request->user()?->id && $data['role'] !== $user->role?->code, 422, 'You cannot change your own role.');

        $before = $this->snapshot($user);

        DB::transaction(function () use ($user, $data, $audit, $before): void {
            $user->fill(Arr::only($data, ['first_name', 'last_name', 'email', 'contact_number', 'department_id', 'team']));
            $user->role_id = $this->roleId($data['role']);
            $user->save();

            $after = $this->snapshot($user->refresh());
            if ($before !== $after) {
                $audit->log('person.updated', $user, meta: ['before' => $before, 'after' => $after]);
            }
        });

        return response()->json(['data' => $this->present($user->load(['role', 'department']))]);
    }

    /** Send the set-password email again, for example when the first link expired. */
    public function invite(User $user, AuditLogger $audit, PersonInviter $inviter): JsonResponse
    {
        Gate::authorize('managePeople', User::class);
        abort_unless($user->canSignIn(), 422, 'This account cannot sign in, so there is nothing to set up.');

        $sent = $inviter->send($user);
        $audit->log('person.invite_sent', $user);

        return response()->json(['invite_sent' => $sent]);
    }

    private function filter(Request $request, string $key): ?string
    {
        $value = $request->query($key);

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    private function roleId(string $code): int
    {
        return (int) Role::query()->where('code', $code)->value('id');
    }

    /** @return array<string, mixed> */
    private function snapshot(User $user): array
    {
        return [
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'contact_number' => $user->contact_number,
            'role' => $user->load('role')->role?->code,
            'team' => $user->team,
            'department_id' => $user->department_id,
        ];
    }

    /** @return array<string, mixed> */
    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'name' => $user->name,
            'email' => $user->email,
            'contact_number' => $user->contact_number,
            'role' => $user->role?->code,
            'role_id' => $user->role_id,
            'role_name' => $user->role?->name,
            'team' => $user->team,
            'team_name' => $user->teamName(),
            'department' => $user->department ? ['id' => $user->department->id, 'name' => $user->department->name] : null,
            'status' => $user->status->value,
            'account_status' => $user->account_status->value,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}

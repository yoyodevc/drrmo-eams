<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Requests;

use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Access\Policies\GrantPolicy;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Validator;

/** Checks the policy first, so a forbidden user gets 403, not a validation error. */
class StoreGrantRequest extends FormRequest
{
    public const LOCATION_MAX_DAYS = 7;

    public function authorize(): bool
    {
        return Gate::allows('manage', PermissionGrant::class);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'permission' => ['required', 'string', 'exists:permissions,code'],
            'event_id' => ['nullable', 'integer', 'exists:events,id'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['required', 'date'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ];
    }

    /** The start in UTC. Left out means now. */
    public function startsAt(): CarbonImmutable
    {
        $start = $this->input('starts_at');

        return $start === null || $start === '' ? CarbonImmutable::now() : CarbonImmutable::parse((string) $start)->utc();
    }

    public function endsAt(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->input('ends_at'))->utc();
    }

    /** @return list<\Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $v): void {
            if ($v->errors()->isNotEmpty()) {
                return;
            }

            $permission = Permission::query()->where('code', $this->string('permission')->value())->firstOrFail();
            $user = User::query()->with('role.permissions')->findOrFail($this->integer('user_id'));
            $start = $this->startsAt();
            $end = $this->endsAt();
            $eventId = $this->filled('event_id') ? $this->integer('event_id') : null;

            if (! $permission->grantable) {
                $v->errors()->add('permission', 'This permission comes only from a role. It cannot be granted.');
            }
            if ($user->account_status !== AccountStatus::Active || $user->isDisabled()) {
                $v->errors()->add('user_id', 'This account cannot sign in, so a grant would do nothing.');
            }
            if ($permission->grantable && $user->role?->permissions->contains('code', $permission->code)) {
                $v->errors()->add('permission', "{$user->first_name}'s role already includes this permission.");
            }
            if ($permission->code === 'reports.submit' && $eventId === null) {
                $v->errors()->add('event_id', 'Choose the event this grant is for.');
            }
            if ($start->lt(CarbonImmutable::now()->subMinutes(5))) {
                $v->errors()->add('starts_at', 'The start cannot be in the past.');
            }
            if ($end->lte($start)) {
                $v->errors()->add('ends_at', 'The end must be after the start.');
            } elseif ($end->lte(CarbonImmutable::now())) {
                $v->errors()->add('ends_at', 'The end must be in the future.');
            }
            if ($permission->code === 'location.view' && $end->gt($start->addDays(self::LOCATION_MAX_DAYS))) {
                $v->errors()->add('ends_at', 'Map access can last 7 days at most.');
            }

            $overlap = PermissionGrant::query()->where('user_id', $user->id)->where('permission_id', $permission->id)
                ->where('event_id', $eventId)->whereNull('revoked_at')
                ->where('starts_at', '<', $end)->where('ends_at', '>', $start)->exists();
            if ($overlap) {
                $v->errors()->add('permission', 'This person already has a grant for this permission that overlaps those dates.');
            }
        }];
    }
}

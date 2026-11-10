<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Models\DutyRequirement;
use App\Modules\Events\Models\Event;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Checks the policy first, so a forbidden user gets 403, not a validation error. */
class StoreAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('assign', Event::class);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        /** @var DutyRequirement $requirement */
        $requirement = $this->route('requirement');

        return [
            // Only approved people with the role the requirement needs, not yet on this event.
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')->where(
                fn ($q) => $q->where('account_status', 'active')->where('status', 'active')->whereNull('disabled_at')
                    ->whereIn('role_id', fn ($r) => $r->select('id')->from('roles')->where('code', $requirement->role)),
            ), Rule::unique('assignments', 'user_id')->where(fn ($q) => $q->where('event_id', $requirement->event_id)->where('status', '!=', 'cancelled'))],
            // Needed only when the duty is already full.
            'override_reason' => ['nullable', 'string', 'min:5', 'max:500'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            /** @var DutyRequirement $requirement */
            $requirement = $this->route('requirement');
            $clash = $requirement->overlapFor((int) $this->input('user_id'));
            if ($clash !== null) {
                $v->errors()->add('user_id', "This person already has a duty at that time ({$clash->event->title}).");
            } elseif ($requirement->isFull() && blank($this->input('override_reason'))) {
                $v->errors()->add('override_reason', 'This duty is already full. Give a reason to add one more person.');
            }
        }];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['user_id.unique' => 'This person is already assigned to the event.'];
    }
}

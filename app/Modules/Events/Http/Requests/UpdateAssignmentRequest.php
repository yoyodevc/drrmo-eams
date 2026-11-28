<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\DutyRequirement;
use App\Modules\Events\Models\Event;
use App\Support\PublicCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Validator;

/** Moves a person to another duty of the same event and role. */
class UpdateAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('assign', Event::class);
    }

    /** Clients send public codes. The rules below work on the ids behind them. */
    protected function prepareForValidation(): void
    {
        if ($this->filled('requirement_id')) {
            $this->merge(['requirement_id' => PublicCode::toId(DutyRequirement::class, $this->input('requirement_id'))]);
        }
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'requirement_id' => ['required', 'integer', 'exists:event_duty_requirements,id'],
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
            /** @var Assignment $assignment */
            $assignment = $this->route('assignment');
            $target = DutyRequirement::query()->findOrFail($this->integer('requirement_id'));
            $user = $assignment->user;
            if (! $user->canSignIn()) {
                $v->errors()->add('requirement_id', 'This person is not active, so they cannot be moved to a duty.');
            } elseif ($target->event_id !== $assignment->event_id || $target->role !== $user->role?->code) {
                $v->errors()->add('requirement_id', 'Pick a duty of the same event that needs this role.');
            } elseif (($clash = $target->overlapFor($assignment->user_id, $assignment->id)) !== null) {
                $v->errors()->add('requirement_id', "This person already has a duty at that time ({$clash->event->title}).");
            } elseif ($target->isFull($assignment->id) && blank($this->input('override_reason'))) {
                $v->errors()->add('override_reason', 'That duty is already full. Give a reason to add one more person.');
            }
        }];
    }
}

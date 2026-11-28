<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Support\PublicCode;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Adds a duty requirement. The shift must sit inside the event time. */
class StoreRequirementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', Event::class);
    }

    /** Clients send public codes. The rules below work on the ids behind them. */
    protected function prepareForValidation(): void
    {
        if ($this->filled('duty_type_id')) {
            $this->merge(['duty_type_id' => PublicCode::toId(DutyType::class, $this->input('duty_type_id'))]);
        }
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'duty_type_id' => ['required', 'integer', Rule::exists('duty_types', 'id')->where('active', true)],
            'role' => ['required', 'in:marshal,volunteer'],
            'team_needed' => ['nullable', 'string', 'max:100'],
            'headcount' => ['required', 'integer', 'min:1', 'max:500'],
            'shift_starts_at' => ['required', 'date'],
            'shift_ends_at' => ['required', 'date', 'after:shift_starts_at'],
            'instructions' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->hasAny(['shift_starts_at', 'shift_ends_at'])) {
                return;
            }
            /** @var Event $event */
            $event = $this->route('event');
            $start = CarbonImmutable::parse((string) $this->input('shift_starts_at'));
            $end = CarbonImmutable::parse((string) $this->input('shift_ends_at'));
            if ($start->lt($event->starts_at) || $end->gt($event->ends_at)) {
                $v->errors()->add('shift_starts_at', 'The shift must sit inside the event time.');
            }
        }];
    }

    /** @return array<string, mixed> */
    public function utcData(): array
    {
        $data = $this->validated();
        foreach (['shift_starts_at', 'shift_ends_at'] as $key) {
            $data[$key] = CarbonImmutable::parse((string) $data[$key])->utc();
        }

        return $data;
    }
}

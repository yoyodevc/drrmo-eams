<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Models\CampusLocation;
use App\Modules\Events\Models\Event;
use App\Modules\Personnel\Models\Department;
use App\Support\PublicCode;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Edits an event: same fields as a new event, and the duty shifts must still fit inside the new times. */
class UpdateEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', Event::class);
    }

    /**
     * Validated input with the date fields converted to UTC.
     * Without this, a time sent as "07:00+08:00" would be stored as 07:00 and read back as UTC.
     *
     * @return array<string, mixed>
     */
    public function utcData(): array
    {
        $data = $this->validated();
        foreach (['starts_at', 'ends_at'] as $key) {
            $data[$key] = CarbonImmutable::parse((string) $data[$key])->utc();
        }

        return $data;
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            /** @var Event $event */
            $event = $this->route('event');
            $data = $this->utcData();
            $outside = $event->requirements()
                ->where(fn ($q) => $q->where('shift_starts_at', '<', $data['starts_at'])->orWhere('shift_ends_at', '>', $data['ends_at']))
                ->exists();
            if ($outside) {
                $v->errors()->add('starts_at', 'Some duty shifts fall outside these times. Change those duties first.');
            }
        }];
    }

    /** Clients send public codes. The rules below work on the ids behind them. */
    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'campus_location_id' => PublicCode::toId(CampusLocation::class, $this->input('campus_location_id')),
            'department_id' => PublicCode::toId(Department::class, $this->input('department_id')),
        ], fn (?int $id) => $id !== null));
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'event_type' => ['required', Rule::exists('event_types', 'code')],
            'description' => ['nullable', 'string', 'max:5000'],
            'campus_location_id' => ['required', 'integer', 'exists:campus_locations,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
        ];
    }
}

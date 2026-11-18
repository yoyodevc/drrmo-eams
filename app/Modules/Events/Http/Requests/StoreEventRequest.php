<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Models\Event;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Checks the policy before validating, so a forbidden user gets 403, not a validation error. */
class StoreEventRequest extends FormRequest
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

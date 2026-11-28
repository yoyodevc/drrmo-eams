<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Models\Event;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Add or edit a duty type. */
class DutyTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Event::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => Str::squish($this->input('name'))]);
        }
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $current = $this->route('duty_type');

        return [
            'name' => ['required', 'string', 'min:2', 'max:100', Rule::unique('duty_types', 'name')->ignore(is_object($current) ? $current->getKey() : null)],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['name.unique' => 'That name is already in use.'];
    }
}

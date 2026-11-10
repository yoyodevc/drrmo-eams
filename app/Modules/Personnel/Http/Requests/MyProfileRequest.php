<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Requests;

use App\Modules\Personnel\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/** A person edits their own contact number. Nothing else is editable here. */
class MyProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageOwnProfile', User::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('contact_number') === '') {
            $this->merge(['contact_number' => null]);
        }
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return ['contact_number' => ['nullable', 'string', 'regex:/^\+?[0-9][0-9 \-]{6,30}$/']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['contact_number.regex' => 'Enter a phone number with digits only, for example 0917 123 4567.'];
    }
}

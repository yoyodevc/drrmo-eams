<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Requests;

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Enums\Team;
use App\Modules\Personnel\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Admin creates or edits a person. Email must be unique. */
class PersonRequest extends FormRequest
{
    // The policy runs before validation, so a person without access gets 403.
    public function authorize(): bool
    {
        return $this->user()?->can('managePeople', User::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($this->input('email')))]);
        }
        if ($this->input('team') === '') {
            $this->merge(['team' => null]);
        }
        if ($this->input('department_id') === '') {
            $this->merge(['department_id' => null]);
        }
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $person = $this->route('user');

        return [
            'first_name' => ['required', 'string', 'min:1', 'max:100'],
            'last_name' => ['required', 'string', 'min:1', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($person instanceof User ? $person->id : null)],
            'contact_number' => ['nullable', 'string', 'regex:/^\+?[0-9][0-9 \-]{6,30}$/'],
            'role' => ['required', Rule::enum(RoleCode::class)],
            'team' => ['nullable', Rule::enum(Team::class)],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'email.unique' => 'Someone already uses this email.',
            'contact_number.regex' => 'Enter a phone number with digits only, for example 0917 123 4567.',
        ];
    }
}

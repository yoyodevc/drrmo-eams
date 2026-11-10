<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Requests;

use App\Modules\Personnel\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class EmergencyContactRequest extends FormRequest
{
    // The policy runs before validation, so a person without access gets 403.
    public function authorize(): bool
    {
        return $this->user()?->can('manageOwnProfile', User::class) ?? false;
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'relationship' => ['required', 'string', 'min:2', 'max:64'],
            'phone' => ['required', 'string', 'regex:/^\+?[0-9][0-9 \-]{6,30}$/'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['phone.regex' => 'Enter a phone number with digits only, for example 0917 123 4567.'];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Requests;

use App\Modules\Personnel\Enums\AvailabilityStatus;
use App\Modules\Personnel\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVolunteerStatusRequest extends FormRequest
{
    // The policy runs before validation, so a non-admin gets 403 and never learns the rules.
    public function authorize(): bool
    {
        return $this->user()?->can('toggleVolunteers', User::class) ?? false;
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(AvailabilityStatus::class)],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ];
    }
}

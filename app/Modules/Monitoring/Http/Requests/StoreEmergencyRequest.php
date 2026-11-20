<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Requests;

use App\Modules\Monitoring\Enums\EmergencyType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** An emergency: a type, an optional short note, an optional photo. The place comes from the latest ping. */
class StoreEmergencyRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The policy runs in the controller, where the assignment is known.
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // Made on the phone, so a queued report sent twice is saved once.
            'client_id' => ['required', 'string', 'min:8', 'max:64', 'regex:/^[A-Za-z0-9-]+$/'],
            'type' => ['required', Rule::enum(EmergencyType::class)],
            'note' => ['nullable', 'string', 'max:500'],
            'photo' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png', 'max:8192'],
        ];
    }
}

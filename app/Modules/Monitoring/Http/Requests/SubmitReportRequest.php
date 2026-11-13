<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** A site report: a short summary and an optional photo (docs/SECURITY_AND_PRIVACY.md section 6). */
class SubmitReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The policy runs in the controller, where the slot is known.
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'summary' => ['required', 'string', 'max:1000'],
            // The type is read from the file's content, not its name. The phone already resized it.
            'photo' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png', 'max:8192'],
        ];
    }
}

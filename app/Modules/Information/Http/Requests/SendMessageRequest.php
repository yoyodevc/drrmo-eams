<?php

declare(strict_types=1);

namespace App\Modules\Information\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** The text of one message. Plain text only, no attachments in v1. */
class SendMessageRequest extends FormRequest
{
    public const MAX_LENGTH = 1000;

    public function authorize(): bool
    {
        // The policy runs in the controller.
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['body' => ['required', 'string', 'max:'.self::MAX_LENGTH]];
    }

    protected function prepareForValidation(): void
    {
        $body = $this->input('body');
        if (is_string($body)) {
            $this->merge(['body' => trim($body)]);
        }
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'body.required' => 'Write a message first.',
            'body.max' => 'Keep the message under '.self::MAX_LENGTH.' characters.',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Information\Http\Requests;

use App\Modules\Information\Enums\MemoCategory;
use App\Modules\Information\Models\Memo;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Post or edit a memo. Upload rules come from docs/SECURITY_AND_PRIVACY.md section 6:
 * PDF, DOCX, JPG or PNG up to 5 MB, type read from the file content.
 */
class SaveMemoRequest extends FormRequest
{
    public const MAX_KB = 5120;

    public function authorize(): bool
    {
        // The policy runs in the controller.
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:160'],
            'category' => ['required', Rule::enum(MemoCategory::class)],
            'body' => ['nullable', 'string', 'max:20000'],
            // `mimes` guesses the type from the content, not the file name.
            'file' => ['nullable', 'file', 'mimes:pdf,docx,jpg,jpeg,png', 'max:'.self::MAX_KB],
            'remove_file' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'file.mimes' => 'Upload a PDF, Word (DOCX), JPG or PNG file.',
            'file.max' => 'The file is too big. The limit is 5 MB.',
        ];
    }

    /** @return list<Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator) {
            /** @var Memo|null $memo */
            $memo = $this->route('memo');
            $keepsFile = $memo?->file_path !== null && ! $this->boolean('remove_file');
            $hasBody = trim((string) $this->input('body')) !== '';
            if (! $hasBody && ! $this->hasFile('file') && ! $keepsFile) {
                $validator->errors()->add('body', 'Write the memo text or attach a file.');
            }
        }];
    }
}

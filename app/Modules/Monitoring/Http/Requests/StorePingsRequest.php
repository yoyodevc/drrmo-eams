<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePingsRequest extends FormRequest
{
    public const MAX_POINTS = 50;

    /** Authorization lives in the controller (ownership, duty state, consent). */
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'points' => ['required', 'array', 'min:1', 'max:'.self::MAX_POINTS],
            'points.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'points.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'points.*.accuracy_m' => ['nullable', 'numeric', 'min:0', 'max:65535'],
            'points.*.captured_at' => ['required', 'date'],
        ];
    }
}

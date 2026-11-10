<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Requests;

use App\Modules\Personnel\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Add or edit a team or a department. Which one is decided by the route: /teams or /departments. */
class OrgUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('managePeople', User::class) ?? false;
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
        $table = $this->is('api/teams*') ? 'teams' : 'departments';
        $current = $this->route('team') ?? $this->route('department');

        return [
            'name' => ['required', 'string', 'min:2', 'max:100', Rule::unique($table, 'name')->ignore(is_object($current) ? $current->getKey() : null)],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['name.unique' => 'That name is already in use.'];
    }
}

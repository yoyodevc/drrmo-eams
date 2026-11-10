<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Requests;

use App\Modules\Access\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Add or rename a custom role. The policy runs first, so a forbidden user gets 403. */
class RoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('manage', Role::class);
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => preg_replace('/\s+/', ' ', trim($this->input('name')))]);
        }
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $role = $this->route('role');

        return [
            'name' => ['required', 'string', 'min:3', 'max:50', Rule::unique('roles', 'name')->ignore($role instanceof Role ? $role->id : null)],
            'description' => ['nullable', 'string', 'max:255'],
            'copy_from' => ['nullable', 'integer', 'exists:roles,id'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['name.unique' => 'A role with this name already exists.'];
    }
}

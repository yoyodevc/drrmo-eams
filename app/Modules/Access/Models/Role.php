<?php

declare(strict_types=1);

namespace App\Modules\Access\Models;

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property bool $is_system
 */
class Role extends Model
{
    protected $fillable = ['code', 'name', 'description', 'is_system'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['is_system' => 'boolean'];
    }

    /** @return BelongsToMany<Permission, $this> */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permission');
    }

    /**
     * People who hold this role. Personnel owns the column, Access only reads it.
     *
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** The built-in role this row is, or null for a custom role. */
    public function builtIn(): ?RoleCode
    {
        return $this->is_system ? RoleCode::tryFrom($this->code) : null;
    }

    public function isAdmin(): bool
    {
        return $this->code === RoleCode::Admin->value;
    }

    /** True for Marshal and Volunteer, the roles events staff by. */
    public function isField(): bool
    {
        return $this->builtIn()?->isField() ?? false;
    }
}

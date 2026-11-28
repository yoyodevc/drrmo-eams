<?php

declare(strict_types=1);

namespace App\Modules\Events\Models;

use App\Support\HasPublicCode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** @property string $public_code */
class DutyType extends Model
{
    use HasPublicCode;

    protected $fillable = ['name', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    /** @return HasMany<DutyRequirement, $this> */
    public function requirements(): HasMany
    {
        return $this->hasMany(DutyRequirement::class);
    }

    /** @return HasMany<Assignment, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }
}

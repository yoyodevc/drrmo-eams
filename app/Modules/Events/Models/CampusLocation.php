<?php

declare(strict_types=1);

namespace App\Modules\Events\Models;

use App\Support\HasPublicCode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** @property string $public_code */
class CampusLocation extends Model
{
    use HasPublicCode;

    protected $fillable = ['name', 'latitude', 'longitude', 'active'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'active' => 'boolean'];
    }

    /** @return HasMany<Event, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Events\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** An event type. Events point at it with events.event_type = event_types.code. */
class EventType extends Model
{
    protected $fillable = ['code', 'name', 'active'];

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    /** @return HasMany<Event, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(Event::class, 'event_type', 'code');
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Access\Models;

use App\Modules\Events\Models\Event;
use App\Modules\Personnel\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int $permission_id
 * @property int|null $event_id
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property string $reason
 * @property Carbon|null $revoked_at
 */
class PermissionGrant extends Model
{
    protected $fillable = ['user_id', 'permission_id', 'event_id', 'starts_at', 'ends_at', 'reason', 'granted_by'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    /**
     * Not revoked, started and not yet ended: starts_at <= now < ends_at.
     *
     * @param  Builder<PermissionGrant>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('revoked_at')->where('starts_at', '<=', now())->where('ends_at', '>', now());
    }

    /** One of: revoked, upcoming, active, ended. */
    public function status(): string
    {
        return match (true) {
            $this->revoked_at !== null => 'revoked',
            $this->starts_at->isFuture() => 'upcoming',
            $this->ends_at->isPast() => 'ended',
            default => 'active',
        };
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Permission, $this> */
    public function permission(): BelongsTo
    {
        return $this->belongsTo(Permission::class);
    }

    /** @return BelongsTo<Event, $this> */
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    /** @return BelongsTo<User, $this> */
    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }

    /** @return BelongsTo<User, $this> */
    public function revokedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }
}

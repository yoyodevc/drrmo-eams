<?php

declare(strict_types=1);

namespace App\Modules\Events\Models;

use App\Modules\Events\Enums\AssignmentStatus;
use App\Modules\Events\Enums\EventStatus;
use App\Modules\Personnel\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property AssignmentStatus $status
 * @property CarbonImmutable|Carbon|null $acknowledged_at
 * @property CarbonImmutable|Carbon|null $duty_started_at
 * @property CarbonImmutable|Carbon|null $duty_ended_at
 * @property CarbonImmutable|Carbon|null $cancelled_at
 */
class Assignment extends Model
{
    protected $attributes = ['status' => 'assigned'];

    protected $fillable = ['event_id', 'requirement_id', 'user_id', 'duty_type_id', 'assigned_by', 'status', 'acknowledged_at', 'duty_started_at', 'duty_ended_at', 'cancelled_at', 'cancel_reason', 'override_reason'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['status' => AssignmentStatus::class, 'acknowledged_at' => 'datetime', 'duty_started_at' => 'datetime', 'duty_ended_at' => 'datetime', 'cancelled_at' => 'datetime'];
    }

    /**
     * Assignments that still hold a place on a duty (not cancelled, not no show, and not on a cancelled event).
     *
     * @param  Builder<Assignment>  $query
     */
    public function scopeLive(Builder $query): void
    {
        $query->whereNotIn('status', [AssignmentStatus::Cancelled->value, AssignmentStatus::NoShow->value])
            ->whereDoesntHave('event', fn (Builder $q) => $q->where('status', EventStatus::Cancelled->value));
    }

    /** @return BelongsTo<Event, $this> */
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    /** @return BelongsTo<DutyRequirement, $this> */
    public function requirement(): BelongsTo
    {
        return $this->belongsTo(DutyRequirement::class, 'requirement_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<DutyType, $this> */
    public function dutyType(): BelongsTo
    {
        return $this->belongsTo(DutyType::class);
    }
}

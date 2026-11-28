<?php

declare(strict_types=1);

namespace App\Modules\Events\Models;

use App\Support\HasPublicCode;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property CarbonImmutable|Carbon $shift_starts_at
 * @property CarbonImmutable|Carbon $shift_ends_at
 * @property string $public_code
 */
class DutyRequirement extends Model
{
    use HasPublicCode;

    protected $table = 'event_duty_requirements';

    protected $fillable = ['event_id', 'duty_type_id', 'role', 'team_needed', 'headcount', 'shift_starts_at', 'shift_ends_at', 'instructions'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['shift_starts_at' => 'datetime', 'shift_ends_at' => 'datetime', 'headcount' => 'integer'];
    }

    /** @return BelongsTo<Event, $this> */
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    /** @return BelongsTo<DutyType, $this> */
    public function dutyType(): BelongsTo
    {
        return $this->belongsTo(DutyType::class);
    }

    /** @return HasMany<Assignment, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'requirement_id');
    }

    /** Live assignment of this person whose shift overlaps this one, if any. */
    public function overlapFor(int $userId, ?int $ignoreAssignmentId = null): ?Assignment
    {
        return Assignment::query()->live()
            ->where('user_id', $userId)
            ->when($ignoreAssignmentId, fn ($q) => $q->where('id', '!=', $ignoreAssignmentId))
            ->whereHas('requirement', fn ($q) => $q->where('id', '!=', $this->id)
                ->where('shift_starts_at', '<', $this->shift_ends_at)
                ->where('shift_ends_at', '>', $this->shift_starts_at))
            ->with('event:id,title')
            ->first();
    }

    /** True when every place on this duty is taken by a live assignment. */
    public function isFull(?int $ignoreAssignmentId = null): bool
    {
        return $this->assignments()->live()
            ->when($ignoreAssignmentId, fn ($q) => $q->where('id', '!=', $ignoreAssignmentId))
            ->count() >= $this->headcount;
    }
}

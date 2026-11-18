<?php

declare(strict_types=1);

namespace App\Modules\Events\Models;

use App\Modules\Events\Enums\EventStatus;
use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Factories\EventFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property EventStatus $status
 * @property string $event_type
 * @property int|null $people_count
 * @property int|null $on_duty_count
 * @property int|string|null $places_needed
 * @property CarbonImmutable|Carbon $starts_at
 * @property CarbonImmutable|Carbon $ends_at
 */
#[UseFactory(EventFactory::class)]
class Event extends Model
{
    /** @use HasFactory<EventFactory> */
    use HasFactory;

    protected $fillable = ['title', 'description', 'event_type', 'campus_location_id', 'department_id', 'starts_at', 'ends_at', 'status', 'created_by'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'status' => EventStatus::class];
    }

    /** @return BelongsTo<EventType, $this> */
    public function type(): BelongsTo
    {
        return $this->belongsTo(EventType::class, 'event_type', 'code');
    }

    /** The type's current name, or the stored code if the type row is gone. */
    public function typeLabel(): string
    {
        return $this->type?->name ?? $this->event_type;
    }

    /** @return BelongsTo<CampusLocation, $this> */
    public function location(): BelongsTo
    {
        return $this->belongsTo(CampusLocation::class, 'campus_location_id');
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<Assignment, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    /** @return HasMany<DutyRequirement, $this> */
    public function requirements(): HasMany
    {
        return $this->hasMany(DutyRequirement::class);
    }
}

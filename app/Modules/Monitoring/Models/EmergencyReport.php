<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Models;

use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\Event;
use App\Modules\Monitoring\Enums\EmergencyStatus;
use App\Modules\Monitoring\Enums\EmergencyType;
use App\Modules\Personnel\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An emergency sent by a person on duty. Flow: sent, acknowledged, resolved. A sent report nobody
 * acknowledged in time gets `escalated_at` and shows as "escalated".
 *
 * @property EmergencyType $type
 * @property EmergencyStatus $status
 * @property float|null $latitude
 * @property float|null $longitude
 * @property CarbonImmutable|Carbon|null $location_captured_at
 * @property CarbonImmutable|Carbon|null $escalated_at
 * @property CarbonImmutable|Carbon|null $acknowledged_at
 * @property CarbonImmutable|Carbon|null $resolved_at
 * @property CarbonImmutable|Carbon $created_at
 */
class EmergencyReport extends Model
{
    protected $fillable = [
        'assignment_id', 'event_id', 'user_id', 'client_id', 'type', 'note', 'photo_path', 'photo_name',
        'latitude', 'longitude', 'accuracy_m', 'location_captured_at', 'status', 'escalated_at',
        'acknowledged_by', 'acknowledged_at', 'resolved_by', 'resolved_at', 'resolution_note',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'type' => EmergencyType::class, 'status' => EmergencyStatus::class,
            'latitude' => 'float', 'longitude' => 'float', 'accuracy_m' => 'integer',
            'location_captured_at' => 'datetime', 'escalated_at' => 'datetime',
            'acknowledged_at' => 'datetime', 'resolved_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Assignment, $this> */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    /** @return BelongsTo<Event, $this> */
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    /** @return BelongsTo<User, $this> */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return BelongsTo<User, $this> */
    public function acknowledger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    /** @return BelongsTo<User, $this> */
    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function hasLocation(): bool
    {
        return $this->latitude !== null && $this->longitude !== null;
    }
}

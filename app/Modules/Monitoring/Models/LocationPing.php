<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Models;

use App\Modules\Events\Models\Assignment;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property CarbonImmutable|Carbon $captured_at
 * @property CarbonImmutable|Carbon $received_at
 */
class LocationPing extends Model
{
    public $timestamps = false;

    protected $fillable = ['assignment_id', 'latitude', 'longitude', 'accuracy_m', 'captured_at', 'received_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'accuracy_m' => 'integer', 'captured_at' => 'datetime', 'received_at' => 'datetime'];
    }

    /** @return BelongsTo<Assignment, $this> */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}

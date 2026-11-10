<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Models;

use App\Modules\Personnel\Enums\AvailabilityStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property AvailabilityStatus $old_status
 * @property AvailabilityStatus $new_status
 * @property string|null $reason
 * @property Carbon|null $created_at
 */
class VolunteerStatusLog extends Model
{
    protected $fillable = ['user_id', 'old_status', 'new_status', 'reason', 'changed_by'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'old_status' => AvailabilityStatus::class,
            'new_status' => AvailabilityStatus::class,
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}

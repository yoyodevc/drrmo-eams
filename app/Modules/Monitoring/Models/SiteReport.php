<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Models;

use App\Modules\Events\Models\Assignment;
use App\Modules\Monitoring\Enums\ReportStatus;
use App\Support\HasPublicCode;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One report slot of one assignment. It starts pending and becomes submitted, overdue, late or missed.
 *
 * @property CarbonImmutable|Carbon $due_at
 * @property ReportStatus $status
 * @property CarbonImmutable|Carbon|null $submitted_at
 * @property CarbonImmutable|Carbon|null $overdue_at
 * @property CarbonImmutable|Carbon|null $missed_at
 * @property string $public_code
 */
class SiteReport extends Model
{
    use HasPublicCode;

    /** A slot becomes overdue this long after it was due. */
    public const OVERDUE_AFTER_MINUTES = 15;

    /** A slot nobody filled is closed as missed this long after it was due. */
    public const MISSED_AFTER_MINUTES = 60;

    protected $fillable = ['assignment_id', 'due_at', 'status', 'summary', 'photo_path', 'photo_name', 'submitted_at', 'overdue_at', 'missed_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['due_at' => 'datetime', 'status' => ReportStatus::class, 'submitted_at' => 'datetime', 'overdue_at' => 'datetime', 'missed_at' => 'datetime'];
    }

    /** @return BelongsTo<Assignment, $this> */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function isOpen(): bool
    {
        return in_array($this->status, [ReportStatus::Pending, ReportStatus::Overdue], true);
    }
}

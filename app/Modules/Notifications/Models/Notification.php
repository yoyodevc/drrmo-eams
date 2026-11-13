<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Events\Models\Assignment;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One message to one person. status: queued, sent or failed.
 *
 * @property int $attempts
 * @property CarbonImmutable|Carbon|null $sent_at
 */
class Notification extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'assignment_id', 'site_report_id', 'subject_user_id', 'type', 'channel', 'status', 'attempts', 'last_error', 'scheduled_for', 'sent_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['attempts' => 'integer', 'scheduled_for' => 'datetime', 'sent_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<SiteReport, $this> */
    public function siteReport(): BelongsTo
    {
        return $this->belongsTo(SiteReport::class);
    }

    /** @return BelongsTo<User, $this> */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }

    /** @return BelongsTo<Assignment, $this> */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}

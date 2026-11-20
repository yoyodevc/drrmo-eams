<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Models;

use App\Modules\Personnel\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One of the (at most 2) marshals who review every site report and emergency. */
class ReportReviewer extends Model
{
    public const UPDATED_AT = null;

    /** The most reviewers there can be. */
    public const MAX = 2;

    protected $fillable = ['user_id', 'assigned_by'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

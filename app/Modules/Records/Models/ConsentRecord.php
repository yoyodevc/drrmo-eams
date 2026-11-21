<?php

declare(strict_types=1);

namespace App\Modules\Records\Models;

use App\Modules\Personnel\Models\User;
use App\Modules\Records\Enums\ConsentPurpose;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property ConsentPurpose $purpose
 * @property Carbon|null $consented_at
 * @property Carbon|null $withdrawn_at
 */
class ConsentRecord extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'purpose', 'notice_version', 'consented_at', 'withdrawn_at', 'ip_address'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'purpose' => ConsentPurpose::class,
            'consented_at' => 'datetime',
            'withdrawn_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

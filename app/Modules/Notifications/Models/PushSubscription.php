<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Personnel\Models\User;
use App\Support\HasPublicCode;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One device that can get push alerts. Personal data: deleted with the account and part of My data.
 *
 * @property CarbonImmutable|Carbon|null $last_used_at
 * @property string $public_code
 */
class PushSubscription extends Model
{
    use HasPublicCode;

    protected $fillable = ['user_id', 'endpoint_hash', 'endpoint', 'public_key', 'auth_token', 'device_label', 'last_used_at'];

    protected $hidden = ['endpoint', 'public_key', 'auth_token'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['last_used_at' => 'datetime'];
    }

    public static function hash(string $endpoint): string
    {
        return hash('sha256', $endpoint);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

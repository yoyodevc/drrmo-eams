<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Models;

use App\Support\HasPublicCode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property string $public_code */
class EmergencyContact extends Model
{
    use HasPublicCode;

    protected $fillable = ['user_id', 'name', 'relationship', 'phone'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

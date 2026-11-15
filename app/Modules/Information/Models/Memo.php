<?php

declare(strict_types=1);

namespace App\Modules\Information\Models;

use App\Modules\Information\Enums\MemoCategory;
use App\Modules\Personnel\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Factories\MemoFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A memo in the DRRMO library: a body, a file, or both. Delete is soft and audited.
 *
 * @property MemoCategory $category
 * @property CarbonImmutable|Carbon $posted_at
 */
class Memo extends Model
{
    /** @use HasFactory<MemoFactory> */
    use HasFactory;

    use SoftDeletes;

    protected $fillable = ['title', 'category', 'body', 'file_path', 'file_name', 'file_mime', 'file_size', 'posted_by', 'posted_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['category' => MemoCategory::class, 'posted_at' => 'datetime', 'file_size' => 'integer'];
    }

    /** @return BelongsTo<User, $this> */
    public function poster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    protected static function newFactory(): MemoFactory
    {
        return MemoFactory::new();
    }
}

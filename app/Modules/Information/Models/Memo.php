<?php

declare(strict_types=1);

namespace App\Modules\Information\Models;

use App\Modules\Information\Enums\MemoCategory;
use App\Modules\Personnel\Models\User;
use App\Support\HasPublicCode;
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
 * @property string $public_code
 */
class Memo extends Model
{
    /** @use HasFactory<MemoFactory> */
    use HasFactory;

    use HasPublicCode;
    use SoftDeletes;

    /** Word files get a PDF copy for the preview pane (ConvertMemoFile). */
    public const WORD_TYPES = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    protected $fillable = ['title', 'category', 'body', 'file_path', 'file_name', 'file_mime', 'file_size', 'preview_path', 'preview_status', 'posted_by', 'posted_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['category' => MemoCategory::class, 'posted_at' => 'datetime', 'file_size' => 'integer'];
    }

    public static function isWordFile(?string $mime): bool
    {
        return in_array($mime, self::WORD_TYPES, true);
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

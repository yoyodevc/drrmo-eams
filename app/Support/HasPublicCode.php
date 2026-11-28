<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

/**
 * For models people open: gives each row a public code and makes routes bind by that code only,
 * so a numeric id in a URL is a 404.
 */
trait HasPublicCode
{
    public static function bootHasPublicCode(): void
    {
        static::creating(function (Model $model): void {
            if (blank($model->getAttribute('public_code'))) {
                $model->setAttribute('public_code', PublicCode::make());
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'public_code';
    }

    /**
     * A copy is a new record, so it gets its own code.
     *
     * @param  array<int, string>|null  $except
     * @return static
     */
    public function replicate(?array $except = null)
    {
        return parent::replicate([...($except ?? []), 'public_code']);
    }
}

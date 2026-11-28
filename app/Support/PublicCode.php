<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

/**
 * The random public code that stands in for a record's number in URLs and in the API.
 * Integer ids stay inside the server.
 */
final class PublicCode
{
    public const LENGTH = 16;

    /** Lower case only, because MySQL compares text without case. No look alike letters. */
    private const LETTERS = 'abcdefghjkmnpqrstuvwxyz';

    private const DIGITS = '23456789';

    /** A new code. It starts with a letter, so it can never look like a record number. */
    public static function make(): string
    {
        $all = self::LETTERS.self::DIGITS;
        $code = self::LETTERS[random_int(0, strlen(self::LETTERS) - 1)];
        for ($i = 1; $i < self::LENGTH; $i++) {
            $code .= $all[random_int(0, strlen($all) - 1)];
        }

        return $code;
    }

    /**
     * The row id behind a code sent by a client. Null when nothing was sent. 0 when the value is not a
     * known code (a record number is not a code), so `exists` rules and filters match nothing.
     *
     * @param  class-string<Model>  $model
     */
    public static function toId(string $model, mixed $code): ?int
    {
        if ($code === null || $code === '') {
            return null;
        }

        return is_string($code) ? (int) $model::query()->where('public_code', $code)->value('id') : 0;
    }

    /**
     * The same for a list. Anything that is not a list comes back unchanged for validation to refuse.
     *
     * @param  class-string<Model>  $model
     */
    public static function toIds(string $model, mixed $codes): mixed
    {
        return is_array($codes) ? array_map(fn (mixed $code) => self::toId($model, $code) ?? 0, $codes) : $codes;
    }
}

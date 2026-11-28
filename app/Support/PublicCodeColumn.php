<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Used by migrations: adds the unique `public_code` column and fills it for the rows already there. */
final class PublicCodeColumn
{
    public static function add(string $table): void
    {
        Schema::table($table, function (Blueprint $blueprint): void {
            $blueprint->string('public_code', PublicCode::LENGTH)->nullable()->after('id');
        });

        DB::table($table)->select('id')->chunkById(500, function ($rows) use ($table): void {
            foreach ($rows as $row) {
                DB::table($table)->where('id', $row->id)->update(['public_code' => PublicCode::make()]);
            }
        });

        Schema::table($table, function (Blueprint $blueprint): void {
            $blueprint->string('public_code', PublicCode::LENGTH)->nullable(false)->change();
            $blueprint->unique('public_code');
        });
    }

    public static function drop(string $table): void
    {
        Schema::table($table, function (Blueprint $blueprint): void {
            $blueprint->dropUnique(['public_code']);
            $blueprint->dropColumn('public_code');
        });
    }
}

<?php

declare(strict_types=1);

use App\Support\PublicCodeColumn;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    private const TABLES = ['roles'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            PublicCodeColumn::add($table);
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            PublicCodeColumn::drop($table);
        }
    }
};

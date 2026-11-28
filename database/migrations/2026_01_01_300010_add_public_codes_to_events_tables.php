<?php

declare(strict_types=1);

use App\Support\PublicCodeColumn;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    private const TABLES = ['duty_types', 'campus_locations', 'events', 'event_duty_requirements', 'assignments'];

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

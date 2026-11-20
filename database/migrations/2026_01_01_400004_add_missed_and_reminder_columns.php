<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_reports', function (Blueprint $table) {
            // When a slot that nobody filled was closed as missed (status `missed`).
            $table->dateTime('missed_at')->nullable()->after('overdue_at');
        });
        Schema::table('emergency_reports', function (Blueprint $table) {
            // When the reviewers were reminded that nobody had acknowledged the report. Once for each report.
            $table->dateTime('reminded_at')->nullable()->after('escalated_at');
        });
    }

    public function down(): void
    {
        Schema::table('site_reports', fn (Blueprint $table) => $table->dropColumn('missed_at'));
        Schema::table('emergency_reports', fn (Blueprint $table) => $table->dropColumn('reminded_at'));
    }
};

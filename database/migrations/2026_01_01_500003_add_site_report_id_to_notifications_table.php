<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            // The report a notice is about, for overdue alerts (docs/DATABASE.md, gap G7).
            $table->foreignId('site_report_id')->nullable()->after('assignment_id')->constrained('site_reports')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('site_report_id');
        });
    }
};

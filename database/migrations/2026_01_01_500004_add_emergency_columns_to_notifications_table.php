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
            // The emergency a notice is about. Plain column, not a foreign key: Notifications does not own that table.
            $table->unsignedBigInteger('emergency_report_id')->nullable()->after('site_report_id');
            // In app alerts (channel in_app) are read by the person. Emails leave this empty.
            $table->dateTime('read_at')->nullable()->after('sent_at');
            $table->index(['user_id', 'channel', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'channel', 'read_at']);
            $table->dropColumn(['emergency_report_id', 'read_at']);
        });
    }
};

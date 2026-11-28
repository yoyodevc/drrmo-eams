<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Admin can retire a duty type without deleting it, the same way event types and locations work.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('duty_types', function (Blueprint $table) {
            $table->boolean('active')->default(true)->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('duty_types', function (Blueprint $table) {
            $table->dropColumn('active');
        });
    }
};

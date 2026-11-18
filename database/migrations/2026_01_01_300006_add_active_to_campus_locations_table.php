<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Admin can retire a location without deleting it, the same way teams and departments work.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campus_locations', function (Blueprint $table) {
            $table->boolean('active')->default(true)->after('longitude');
        });
    }

    public function down(): void
    {
        Schema::table('campus_locations', function (Blueprint $table) {
            $table->dropColumn('active');
        });
    }
};

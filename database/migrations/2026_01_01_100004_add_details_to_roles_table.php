<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Access module. Roles become editable data: a short description, and a flag for the four built-in
// roles, which cannot be renamed or deleted. Custom roles have is_system false.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('description', 255)->nullable()->after('name');
            $table->boolean('is_system')->default(false)->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['description', 'is_system']);
        });
    }
};

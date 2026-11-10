<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Teams used to be a fixed enum. Now admin manages them. users.team keeps pointing at teams.code,
// so the three starting teams are inserted here with the codes people already have.
// Departments get an active flag so a retired one can be hidden without deleting it.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 100)->unique();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        $now = now();
        DB::table('teams')->insert([
            ['code' => 'ert', 'name' => 'ERT', 'active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'security', 'name' => 'Security team', 'active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'fire_suppression', 'name' => 'Fire suppression', 'active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        Schema::table('departments', function (Blueprint $table) {
            $table->boolean('active')->default(true)->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('active');
        });
        Schema::dropIfExists('teams');
    }
};

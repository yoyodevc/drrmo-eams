<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Event types used to be a fixed enum. Now admin manages them. events.event_type keeps pointing at
// event_types.code, so the six starting types are inserted here with the codes events already have.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_types', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 100)->unique();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        $now = now();
        $starting = ['academic' => 'Academic', 'ceremony' => 'Ceremony', 'sports' => 'Sports', 'cultural' => 'Cultural', 'drill' => 'Drill', 'other' => 'Other'];
        foreach ($starting as $code => $name) {
            DB::table('event_types')->insert(['code' => $code, 'name' => $name, 'active' => true, 'created_at' => $now, 'updated_at' => $now]);
        }

        Schema::table('events', function (Blueprint $table) {
            $table->string('event_type', 32)->default('other')->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_types');
    }
};

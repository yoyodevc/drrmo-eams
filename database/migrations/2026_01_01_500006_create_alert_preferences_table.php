<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Kept here, not on users, so Notifications never writes to a Personnel table.
        Schema::create('alert_preferences', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->boolean('sound_muted')->default(false);
            $table->boolean('push_muted')->default(false);
            $table->string('quiet_start', 5)->nullable();
            $table->string('quiet_end', 5)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_preferences');
    }
};

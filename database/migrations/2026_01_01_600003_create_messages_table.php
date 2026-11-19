<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            // People are never deleted, only closed (docs/DATABASE.md section 3), so restrict.
            $table->foreignId('sender_id')->constrained('users')->restrictOnDelete();
            // Null means the DRRMO office inbox, which every admin can read and answer (gap G11).
            $table->foreignId('recipient_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('body');
            $table->dateTime('sent_at');
            $table->dateTime('read_at')->nullable();

            $table->index(['recipient_id', 'read_at']);
            $table->index(['sender_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};

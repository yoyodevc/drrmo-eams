<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // True for a person-to-person message. False is the office conversation (recipient null: to
            // the office, recipient set: an admin answering for the office).
            $table->boolean('is_direct')->default(false)->after('recipient_id');
            $table->index(['recipient_id', 'sender_id', 'is_direct']);
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['recipient_id', 'sender_id', 'is_direct']);
            $table->dropColumn('is_direct');
        });
    }
};

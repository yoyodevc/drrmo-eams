<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('memos', function (Blueprint $table) {
            // A PDF copy of a Word file, so the memo page can show it exactly as Word lays it out.
            // Random name under storage/app/private/memos/previews.
            $table->string('preview_path')->nullable()->after('file_size');
            // pending, ready or failed. Null when the file needs no copy (PDF, image) or there is no file.
            $table->string('preview_status', 16)->nullable()->after('preview_path');
        });
    }

    public function down(): void
    {
        Schema::table('memos', function (Blueprint $table) {
            $table->dropColumn(['preview_path', 'preview_status']);
        });
    }
};

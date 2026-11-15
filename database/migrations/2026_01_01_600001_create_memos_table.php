<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('memos', function (Blueprint $table) {
            $table->id();
            $table->string('title', 160);
            // policy, procedure, advisory, training, other (MemoCategory enum).
            $table->string('category', 24);
            // A memo has a body, a file, or both (docs/DATABASE.md, gap G12).
            $table->text('body')->nullable();
            // Random name under storage/app/private/memos. The original name is kept only here.
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->string('file_mime', 100)->nullable();
            $table->unsignedInteger('file_size')->nullable();
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('posted_at');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category', 'posted_at']);
            // Memo search (S5.2). SQLite, used in quick local test runs, has no FULLTEXT.
            if (Schema::getConnection()->getDriverName() === 'mysql') {
                $table->fullText(['title', 'body']);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('memos');
    }
};

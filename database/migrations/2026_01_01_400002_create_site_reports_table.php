<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            // One slot per assignment and due time, so the scheduler can run again without making copies.
            $table->dateTime('due_at');
            // pending, submitted, overdue, late (docs/DATABASE.md, gap G6).
            $table->string('status', 12)->default('pending');
            $table->string('summary', 1000)->nullable();
            $table->string('photo_path')->nullable();
            $table->string('photo_name')->nullable();
            $table->dateTime('submitted_at')->nullable();
            $table->dateTime('overdue_at')->nullable();
            $table->timestamps();

            $table->unique(['assignment_id', 'due_at']);
            $table->index(['status', 'due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_reports');
    }
};

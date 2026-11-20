<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emergency_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Made on the phone, so a report queued offline is not saved twice when it is sent again.
            $table->string('client_id', 64);
            // medical, fire, security, other.
            $table->string('type', 12);
            $table->string('note', 500)->nullable();
            $table->string('photo_path')->nullable();
            $table->string('photo_name')->nullable();
            // Copied from the latest ping of the assignment when the report is saved. Location data: admin and reviewers only.
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 9, 6)->nullable();
            $table->unsignedSmallInteger('accuracy_m')->nullable();
            $table->dateTime('location_captured_at')->nullable();
            // sent, acknowledged, resolved.
            $table->string('status', 12)->default('sent');
            $table->dateTime('escalated_at')->nullable();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('acknowledged_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('resolved_at')->nullable();
            $table->string('resolution_note', 500)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'client_id']);
            $table->index(['status', 'created_at']);
            $table->index('event_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('emergency_reports');
    }
};

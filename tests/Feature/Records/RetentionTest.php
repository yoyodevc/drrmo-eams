<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(fn () => $this->seed());

it('prunes audit rows older than 3 years and keeps newer ones', function () {
    AuditLog::query()->create(['action' => 'old.thing', 'entity' => 'x']);
    AuditLog::query()->create(['action' => 'new.thing', 'entity' => 'x']);
    DB::table('audit_logs')->where('action', 'old.thing')->update(['created_at' => now()->subYears(3)->subDay()]);

    $this->artisan('records:prune-audit-logs')->assertSuccessful();

    expect(AuditLog::query()->where('action', 'old.thing')->exists())->toBeFalse()
        ->and(AuditLog::query()->where('action', 'new.thing')->exists())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'records.pruned')->exists())->toBeTrue();
});

it('prunes notifications older than 6 months', function () {
    $user = User::factory()->role(RoleCode::Volunteer)->create();
    $old = DB::table('notifications')->insertGetId(['user_id' => $user->id, 'type' => 'shift_reminder', 'created_at' => now()->subMonths(6)->subDay()]);
    $new = DB::table('notifications')->insertGetId(['user_id' => $user->id, 'type' => 'shift_reminder', 'created_at' => now()->subMonths(5)]);

    $this->artisan('notifications:prune')->assertSuccessful();

    expect(DB::table('notifications')->where('id', $old)->exists())->toBeFalse()
        ->and(DB::table('notifications')->where('id', $new)->exists())->toBeTrue();
});

it('deletes photos older than a year but keeps the report', function () {
    Storage::fake('local');
    Storage::disk('local')->put('reports/old.jpg', 'x');
    Storage::disk('local')->put('reports/new.jpg', 'x');
    $user = User::factory()->role(RoleCode::Volunteer)->create();
    $row = fn (string $path, $when) => DB::table('emergency_reports')->insertGetId(['assignment_id' => 1, 'event_id' => 1, 'client_id' => (string) Str::uuid(), 'user_id' => $user->id, 'type' => 'medical', 'photo_path' => $path, 'photo_name' => $path, 'status' => 'sent', 'created_at' => $when, 'updated_at' => $when]);
    Schema::disableForeignKeyConstraints();
    $old = $row('reports/old.jpg', now()->subYear()->subDay());
    $new = $row('reports/new.jpg', now()->subMonths(2));
    Schema::enableForeignKeyConstraints();

    $this->artisan('monitoring:prune-photos')->assertSuccessful();

    expect(EmergencyReport::query()->find($old)->photo_path)->toBeNull()
        ->and(EmergencyReport::query()->find($new)->photo_path)->toBe('reports/new.jpg');
    Storage::disk('local')->assertMissing('reports/old.jpg');
    Storage::disk('local')->assertExists('reports/new.jpg');
});

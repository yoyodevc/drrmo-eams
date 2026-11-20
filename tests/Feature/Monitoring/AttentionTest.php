<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/reportHelpers.php';

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 14:00:00'));
});

function slotFor(User $user, $assignment, string $due, string $status): SiteReport
{
    return SiteReport::query()->create(['assignment_id' => $assignment->id, 'due_at' => CarbonImmutable::parse($due), 'status' => $status]);
}

it('lists open emergencies first, then overdue and missed reports, with a summary for each event', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Mara', 'last_name' => 'Reyes']);
    $assignment = reportAssignment($marshal, '2026-11-16 06:00:00', 10);
    slotFor($marshal, $assignment, '2026-11-16 08:00:00', 'submitted');
    slotFor($marshal, $assignment, '2026-11-16 10:00:00', 'late');
    slotFor($marshal, $assignment, '2026-11-16 12:00:00', 'missed');
    slotFor($marshal, $assignment, '2026-11-16 13:50:00', 'overdue');
    slotFor($marshal, $assignment, '2026-11-16 16:00:00', 'pending');
    EmergencyReport::query()->create(['assignment_id' => $assignment->id, 'event_id' => $assignment->event_id, 'user_id' => $marshal->id, 'client_id' => 'abcd1234', 'type' => 'fire', 'status' => 'sent']);
    EmergencyReport::query()->create(['assignment_id' => $assignment->id, 'event_id' => $assignment->event_id, 'user_id' => $marshal->id, 'client_id' => 'efgh5678', 'type' => 'medical', 'status' => 'resolved']);
    $admin = User::factory()->role(RoleCode::Admin)->create();

    $response = $this->withAuthCookies(loginCookies($admin))->getJson('/api/attention')->assertOk();
    $response->assertJsonCount(1, 'data.emergencies')->assertJsonPath('data.emergencies.0.type', 'fire')
        ->assertJsonPath('data.reports.0.status', 'overdue')->assertJsonPath('data.reports.1.status', 'missed')
        ->assertJsonPath('data.events.0.on_time', 1)->assertJsonPath('data.events.0.late', 1)
        ->assertJsonPath('data.events.0.missed', 1)->assertJsonPath('data.events.0.overdue', 1);
    expect(AuditLog::query()->where('action', 'attention.viewed')->count())->toBe(1);
});

it('keeps the needs attention view from people without report access', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();

    $this->withAuthCookies(loginCookies($marshal))->getJson('/api/attention')->assertForbidden();
});

it('shows the reporter the emergencies of the event since the previous report, without place or photo', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = reportAssignment($marshal, '2026-11-16 06:00:00', 10);
    designate($marshal, $assignment->event_id);
    slotFor($marshal, $assignment, '2026-11-16 12:00:00', 'submitted');
    $slot = slotFor($marshal, $assignment, '2026-11-16 14:00:00', 'pending');
    $other = User::factory()->role(RoleCode::Volunteer)->create(['first_name' => 'Vic', 'last_name' => 'Cruz']);
    $otherAssignment = $assignment->replicate(['user_id'])->fill(['user_id' => $other->id]);
    $otherAssignment->save();
    $make = fn (string $client, string $at) => EmergencyReport::query()->forceCreate([
        'assignment_id' => $otherAssignment->id, 'event_id' => $assignment->event_id, 'user_id' => $other->id, 'client_id' => $client,
        'type' => 'security', 'note' => 'Fight at gate 2', 'status' => 'sent', 'latitude' => 6.92, 'longitude' => 122.07, 'created_at' => $at, 'updated_at' => $at,
    ]);
    $make('before-12', '2026-11-16 11:30:00');
    $make('after-12', '2026-11-16 12:30:00');

    $response = $this->withAuthCookies(loginCookies($marshal))->getJson("/api/me/report-slots/{$slot->id}/emergencies")->assertOk();
    $response->assertJsonCount(1, 'data')->assertJsonPath('data.0.reporter', 'Vic Cruz')->assertJsonPath('data.0.note', 'Fight at gate 2');
    expect(json_encode($response->json()))->not->toContain('122.07');

    $this->withAuthCookies(loginCookies($other))->getJson("/api/me/report-slots/{$slot->id}/emergencies")->assertForbidden();
});

it('audits the report feed, one report and its photo when a reader looks at them', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = reportAssignment($marshal, '2026-11-16 06:00:00', 10);
    $slot = slotFor($marshal, $assignment, '2026-11-16 12:00:00', 'submitted');
    Storage::disk('local')->put('reports/x.jpg', 'x');
    $slot->update(['photo_path' => 'reports/x.jpg', 'summary' => 'Calm.']);
    $admin = User::factory()->role(RoleCode::Admin)->create();

    $this->withAuthCookies(loginCookies($admin))->getJson('/api/reports')->assertOk();
    $this->withAuthCookies(loginCookies($admin))->getJson("/api/reports/{$slot->id}")->assertOk();
    $this->withAuthCookies(loginCookies($admin))->get("/api/reports/{$slot->id}/photo")->assertOk();

    foreach (['report.feed_viewed', 'report.viewed', 'report.photo_viewed'] as $action) {
        expect(AuditLog::query()->where('action', $action)->where('actor_id', $admin->id)->count())->toBe(1);
    }

    // A refused request leaves no row.
    $this->withAuthCookies(loginCookies($marshal))->getJson("/api/reports/{$slot->id}")->assertForbidden();
    expect(AuditLog::query()->where('action', 'report.viewed')->count())->toBe(1);
});

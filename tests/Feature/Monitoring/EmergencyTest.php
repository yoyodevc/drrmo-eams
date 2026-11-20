<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Models\LocationPing;
use App\Modules\Monitoring\Models\ReportReviewer;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/reportHelpers.php';

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
});

/** A marshal on duty with a fresh ping, two reviewer marshals and one admin. */
function emergencyScene(): array
{
    $user = User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Mara', 'last_name' => 'Reyes']);
    $assignment = reportAssignment($user);
    LocationPing::query()->create(['assignment_id' => $assignment->id, 'latitude' => 6.9214, 'longitude' => 122.0790, 'accuracy_m' => 12, 'captured_at' => now()->subMinute(), 'received_at' => now()]);
    $reviewers = User::factory()->role(RoleCode::Marshal)->count(2)->create();
    foreach ($reviewers as $r) {
        ReportReviewer::query()->create(['user_id' => $r->id]);
    }
    $admin = User::factory()->role(RoleCode::Admin)->create();

    return [$user, $assignment, $reviewers, $admin];
}

function sendEmergency($test, User $user, int $assignmentId, array $over = [])
{
    return $test->withAuthCookies(loginCookies($user))->post("/api/me/assignments/{$assignmentId}/emergencies", [
        'client_id' => 'abcd1234-ef56', 'type' => 'medical', 'note' => 'Student fainted at gate 2.', ...$over,
    ], ['Accept' => 'application/json']);
}

it('saves an emergency with the latest ping and a photo, and alerts reviewers and admins in app and by email', function () {
    [$user, $assignment, $reviewers, $admin] = emergencyScene();

    $response = sendEmergency($this, $user, $assignment->id, ['photo' => UploadedFile::fake()->createWithContent('a.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='))])->assertCreated();
    $response->assertJsonPath('data.status', 'sent')->assertJsonPath('data.has_photo', true);

    $report = EmergencyReport::query()->firstOrFail();
    expect($report->latitude)->toBe(6.9214)->and($report->photo_path)->toStartWith('emergencies/');
    Storage::disk('local')->assertExists($report->photo_path);

    $recipients = $reviewers->pluck('id')->push($admin->id)->all();
    foreach ($recipients as $id) {
        expect(Notification::query()->where('user_id', $id)->where('channel', 'in_app')->where('type', 'emergency.reported')->count())->toBe(1)
            ->and(Notification::query()->where('user_id', $id)->where('channel', 'email')->where('type', 'emergency.reported')->where('status', 'sent')->count())->toBe(1);
    }
    expect(Notification::query()->where('user_id', $user->id)->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'emergency.sent')->count())->toBe(1);
});

it('saves a queued emergency once when it is sent again', function () {
    [$user, $assignment] = emergencyScene();

    sendEmergency($this, $user, $assignment->id)->assertCreated();
    sendEmergency($this, $user, $assignment->id)->assertOk();

    expect(EmergencyReport::query()->count())->toBe(1)->and(Notification::query()->where('type', 'emergency.reported')->where('channel', 'in_app')->count())->toBe(3);
});

it('refuses an emergency from someone not on duty or for another persons duty', function () {
    [$user, $assignment] = emergencyScene();
    $other = User::factory()->role(RoleCode::Marshal)->create();
    $idle = reportAssignment($other, status: 'assigned');

    sendEmergency($this, $other, $assignment->id)->assertForbidden();
    sendEmergency($this, $other, $idle->id)->assertForbidden();
    expect(EmergencyReport::query()->count())->toBe(0);
});

it('validates the type and the note length', function () {
    [$user, $assignment] = emergencyScene();

    sendEmergency($this, $user, $assignment->id, ['type' => 'flood'])->assertUnprocessable();
    sendEmergency($this, $user, $assignment->id, ['note' => str_repeat('a', 501)])->assertUnprocessable();
});

it('keeps the list and the detail from people who are not reviewers', function () {
    [$user, $assignment] = emergencyScene();
    sendEmergency($this, $user, $assignment->id)->assertCreated();
    $report = EmergencyReport::query()->firstOrFail();
    $stranger = User::factory()->role(RoleCode::Volunteer)->create();

    foreach ([$user, $stranger] as $who) {
        $this->withAuthCookies(loginCookies($who))->getJson('/api/emergencies')->assertForbidden();
        $this->withAuthCookies(loginCookies($who))->getJson("/api/emergencies/{$report->id}")->assertForbidden();
        $this->withAuthCookies(loginCookies($who))->postJson("/api/emergencies/{$report->id}/acknowledge")->assertForbidden();
        $this->withAuthCookies(loginCookies($who))->postJson("/api/emergencies/{$report->id}/resolve")->assertForbidden();
    }
    expect($report->fresh()->status->value)->toBe('sent');
});

it('lets a reviewer see the location and audits every view', function () {
    [$user, $assignment, $reviewers] = emergencyScene();
    sendEmergency($this, $user, $assignment->id)->assertCreated();
    $report = EmergencyReport::query()->firstOrFail();

    $list = $this->withAuthCookies(loginCookies($reviewers[0]))->getJson('/api/emergencies')->assertOk();
    expect(json_encode($list->json()))->not->toContain('6.9214');

    $this->withAuthCookies(loginCookies($reviewers[0]))->getJson("/api/emergencies/{$report->id}")->assertOk()
        ->assertJsonPath('data.location.lat', 6.9214)->assertJsonPath('data.reporter', 'Mara Reyes');
    expect(AuditLog::query()->where('action', 'emergency.location_viewed')->where('actor_id', $reviewers[0]->id)->count())->toBe(1);
});

it('follows sent, acknowledged, resolved, and the reporter sees who and when', function () {
    [$user, $assignment, $reviewers] = emergencyScene();
    sendEmergency($this, $user, $assignment->id)->assertCreated();
    $report = EmergencyReport::query()->firstOrFail();

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:02:00'));
    $this->withAuthCookies(loginCookies($reviewers[0]))->postJson("/api/emergencies/{$report->id}/acknowledge")->assertOk()->assertJsonPath('data.status', 'acknowledged');
    // A second reviewer does not take it over.
    $this->withAuthCookies(loginCookies($reviewers[1]))->postJson("/api/emergencies/{$report->id}/acknowledge")->assertOk();
    expect($report->fresh()->acknowledged_by)->toBe($reviewers[0]->id);

    $mine = $this->withAuthCookies(loginCookies($user))->getJson('/api/me/emergencies')->assertOk();
    $mine->assertJsonPath('data.0.status', 'acknowledged')->assertJsonPath('data.0.acknowledged_by', $reviewers[0]->name);

    $this->withAuthCookies(loginCookies($reviewers[0]))->postJson("/api/emergencies/{$report->id}/resolve", ['note' => 'Taken to the clinic.'])->assertOk()->assertJsonPath('data.status', 'resolved');
    $this->withAuthCookies(loginCookies($user))->getJson('/api/me/emergencies')->assertJsonPath('data.0.status', 'resolved')->assertJsonPath('data.0.resolution_note', 'Taken to the clinic.');
    expect(AuditLog::query()->whereIn('action', ['emergency.acknowledged', 'emergency.resolved'])->count())->toBe(2);
});

it('escalates an unacknowledged emergency to the admins after 5 minutes, once, and the reporter sees escalated', function () {
    [$user, $assignment, $reviewers, $admin] = emergencyScene();
    sendEmergency($this, $user, $assignment->id)->assertCreated();
    $report = EmergencyReport::query()->firstOrFail();

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:04:00'));
    Artisan::call('monitoring:escalate-emergencies');
    expect($report->fresh()->escalated_at)->toBeNull();

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:05:00'));
    Artisan::call('monitoring:escalate-emergencies');
    Artisan::call('monitoring:escalate-emergencies');
    expect($report->fresh()->escalated_at)->not->toBeNull()
        ->and(Notification::query()->where('user_id', $admin->id)->where('type', 'emergency.escalated')->where('channel', 'in_app')->count())->toBe(1)
        ->and(Notification::query()->where('user_id', $reviewers[0]->id)->where('type', 'emergency.escalated')->count())->toBe(0);

    $this->withAuthCookies(loginCookies($user))->getJson('/api/me/emergencies')->assertJsonPath('data.0.status', 'escalated');
});

it('does not escalate an acknowledged emergency', function () {
    [$user, $assignment, $reviewers] = emergencyScene();
    sendEmergency($this, $user, $assignment->id)->assertCreated();
    $report = EmergencyReport::query()->firstOrFail();
    $this->withAuthCookies(loginCookies($reviewers[0]))->postJson("/api/emergencies/{$report->id}/acknowledge")->assertOk();

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:30:00'));
    Artisan::call('monitoring:escalate-emergencies');

    expect($report->fresh()->escalated_at)->toBeNull();
});

it('shows each person only their own in app alerts and lets them mark them read', function () {
    [$user, $assignment, $reviewers] = emergencyScene();
    sendEmergency($this, $user, $assignment->id)->assertCreated();

    $this->withAuthCookies(loginCookies($reviewers[0]))->getJson('/api/me/alerts')->assertOk()->assertJsonPath('unread', 1)->assertJsonPath('data.0.about', 'Mara Reyes');
    $this->withAuthCookies(loginCookies($user))->getJson('/api/me/alerts')->assertJsonPath('unread', 0);
    $this->withAuthCookies(loginCookies($reviewers[0]))->postJson('/api/me/alerts/read')->assertOk();
    $this->withAuthCookies(loginCookies($reviewers[0]))->getJson('/api/me/alerts')->assertJsonPath('unread', 0);
    // In app alerts stay out of the list of sent emails.
    $this->withAuthCookies(loginCookies($reviewers[0]))->getJson('/api/me/notifications')->assertJsonCount(1, 'data');
});

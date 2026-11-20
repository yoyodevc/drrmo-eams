<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Models\ReportReviewer;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;

require_once __DIR__.'/reportHelpers.php';

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
});

it('lets an admin pick up to 2 marshals as reviewers and audits it', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    [$a, $b, $c] = User::factory()->role(RoleCode::Marshal)->count(3)->create();

    $this->withAuthCookies(loginCookies($admin))->putJson('/api/report-reviewers', ['user_ids' => [$a->id, $b->id]])
        ->assertOk()->assertJsonPath('data.user_ids', [$a->id, $b->id]);
    expect(ReportReviewer::query()->count())->toBe(2);

    // Swapping one out keeps the limit.
    $this->withAuthCookies(loginCookies($admin))->putJson('/api/report-reviewers', ['user_ids' => [$b->id, $c->id]])->assertOk();
    expect(ReportReviewer::query()->pluck('user_id')->sort()->values()->all())->toBe(collect([$b->id, $c->id])->sort()->values()->all())
        ->and(AuditLog::query()->where('action', 'report_reviewers.changed')->count())->toBe(2);

    $this->withAuthCookies(loginCookies($admin))->getJson('/api/report-reviewers')->assertOk()->assertJsonCount(3, 'data.candidates');
});

it('refuses a third reviewer, a non marshal, and anyone but an admin', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    [$a, $b, $c] = User::factory()->role(RoleCode::Marshal)->count(3)->create();
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();

    $this->withAuthCookies(loginCookies($admin))->putJson('/api/report-reviewers', ['user_ids' => [$a->id, $b->id, $c->id]])->assertUnprocessable();
    $this->withAuthCookies(loginCookies($admin))->putJson('/api/report-reviewers', ['user_ids' => [$volunteer->id]])->assertUnprocessable();
    $this->withAuthCookies(loginCookies($a))->putJson('/api/report-reviewers', ['user_ids' => [$a->id]])->assertForbidden();
    $this->withAuthCookies(loginCookies($a))->getJson('/api/report-reviewers')->assertForbidden();
    expect(ReportReviewer::query()->count())->toBe(0);
});

it('gives a reviewer the reports permission for every event, and takes it back when removed', function () {
    $reviewer = User::factory()->role(RoleCode::Marshal)->create();
    $author = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = reportAssignment($author);
    SiteReport::query()->create(['assignment_id' => $assignment->id, 'due_at' => now()->subHour(), 'status' => 'submitted', 'summary' => 'All calm.']);

    $this->withAuthCookies(loginCookies($reviewer))->getJson('/api/reports')->assertForbidden();

    ReportReviewer::query()->create(['user_id' => $reviewer->id]);
    $this->withAuthCookies(loginCookies($reviewer))->getJson('/api/reports')->assertOk()->assertJsonCount(1, 'data');
    $this->withAuthCookies(loginCookies($reviewer))->getJson('/api/me')->assertJsonFragment(['reports.view']);

    ReportReviewer::query()->delete();
    $this->withAuthCookies(loginCookies($reviewer))->getJson('/api/reports')->assertForbidden();
});

/** A designated reporter with one slot due at 12:00. */
function slotDueAt(string $due, string $status = 'pending'): array
{
    $user = User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Mara', 'last_name' => 'Reyes']);
    $assignment = reportAssignment($user, '2026-11-16 08:00:00', 8);
    designate($user, $assignment->event_id);

    return [$user, SiteReport::query()->create(['assignment_id' => $assignment->id, 'due_at' => CarbonImmutable::parse($due), 'status' => $status])];
}

it('reminds the reporter 15 minutes before and at the due time, in app and by email, once each', function () {
    [$user, $slot] = slotDueAt('2026-11-16 10:20:00');

    Artisan::call('notifications:send-report-reminders');
    expect(Notification::query()->where('user_id', $user->id)->count())->toBe(0);

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:05:00'));
    Artisan::call('notifications:send-report-reminders');
    Artisan::call('notifications:send-report-reminders');
    expect(Notification::query()->where('user_id', $user->id)->where('type', 'report.reminder')->where('channel', 'in_app')->count())->toBe(1)
        ->and(Notification::query()->where('user_id', $user->id)->where('type', 'report.reminder')->where('channel', 'email')->where('status', 'sent')->count())->toBe(1);

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:20:00'));
    Artisan::call('notifications:send-report-reminders');
    Artisan::call('notifications:send-report-reminders');
    expect(Notification::query()->where('user_id', $user->id)->where('type', 'report.due')->where('channel', 'in_app')->count())->toBe(1)
        ->and(Notification::query()->where('user_id', $user->id)->count())->toBe(4);
});

it('does not remind about a report that is already sent, and hides its old alert', function () {
    [$user, $slot] = slotDueAt('2026-11-16 10:10:00');
    Artisan::call('notifications:send-report-reminders');
    $this->withAuthCookies(loginCookies($user))->getJson('/api/me/alerts')->assertJsonPath('unread', 1)->assertJsonPath('data.0.site_report_id', $slot->id);

    $slot->update(['status' => 'submitted']);
    $this->withAuthCookies(loginCookies($user))->getJson('/api/me/alerts')->assertJsonPath('unread', 0);

    [$other, $sent] = slotDueAt('2026-11-16 10:10:00', 'submitted');
    Artisan::call('notifications:send-report-reminders');
    expect(Notification::query()->where('user_id', $other->id)->count())->toBe(0);
});

it('closes a slot nobody filled as missed an hour after it was due, once, and tells the readers', function () {
    [$user, $slot] = slotDueAt('2026-11-16 09:00:00', 'overdue');
    $reviewer = User::factory()->role(RoleCode::Marshal)->create();
    ReportReviewer::query()->create(['user_id' => $reviewer->id]);
    $admin = User::factory()->role(RoleCode::Admin)->create();

    $this->travelTo(CarbonImmutable::parse('2026-11-16 09:59:00'));
    Artisan::call('monitoring:mark-missed-reports');
    expect($slot->fresh()->status->value)->toBe('overdue');

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    Artisan::call('monitoring:mark-missed-reports');
    Artisan::call('monitoring:mark-missed-reports');
    expect($slot->fresh()->status->value)->toBe('missed')->and($slot->fresh()->missed_at)->not->toBeNull()
        ->and(Notification::query()->where('type', 'report.missed')->where('channel', 'in_app')->whereIn('user_id', [$reviewer->id, $admin->id])->count())->toBe(2)
        ->and(Notification::query()->where('user_id', $user->id)->where('type', 'report.missed')->count())->toBe(0);
});

it('does not let a missed report be filled in', function () {
    [$user, $slot] = slotDueAt('2026-11-16 08:00:00', 'missed');

    $this->withAuthCookies(loginCookies($user))->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'Too late.'])->assertUnprocessable();
    expect($slot->fresh()->summary)->toBeNull();
});

it('reminds only the reviewer marshals once when an emergency is still unacknowledged after 2 minutes', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = reportAssignment($user);
    $reviewer = User::factory()->role(RoleCode::Marshal)->create();
    ReportReviewer::query()->create(['user_id' => $reviewer->id]);
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $report = EmergencyReport::query()->create(['assignment_id' => $assignment->id, 'event_id' => $assignment->event_id, 'user_id' => $user->id, 'client_id' => 'abcd1234', 'type' => 'fire', 'status' => 'sent']);

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:01:00'));
    Artisan::call('monitoring:remind-emergencies');
    expect(Notification::query()->where('type', 'emergency.reminder')->count())->toBe(0);

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:02:00'));
    Artisan::call('monitoring:remind-emergencies');
    Artisan::call('monitoring:remind-emergencies');
    expect(Notification::query()->where('type', 'emergency.reminder')->where('channel', 'in_app')->pluck('user_id')->all())->toBe([$reviewer->id])
        ->and(Notification::query()->where('user_id', $admin->id)->where('type', 'emergency.reminder')->count())->toBe(0);

    // An acknowledged emergency is not reminded about.
    $second = EmergencyReport::query()->create(['assignment_id' => $assignment->id, 'event_id' => $assignment->event_id, 'user_id' => $user->id, 'client_id' => 'efgh5678', 'type' => 'fire', 'status' => 'acknowledged']);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:30:00'));
    Artisan::call('monitoring:remind-emergencies');
    expect($second->fresh()->reminded_at)->toBeNull();
});

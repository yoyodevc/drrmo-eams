<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
});

function logRow(User $to, string $status, array $extra = []): Notification
{
    return Notification::query()->create(['user_id' => $to->id, 'type' => 'assignment.created', 'status' => $status] + $extra);
}

it('lists notifications with filters and today count against the limit', function () {
    config(['mail.daily_limit' => 300]);
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    logRow($marshal, 'sent', ['sent_at' => now()]);
    logRow($marshal, 'sent', ['sent_at' => now()->subDays(3)]);
    logRow($marshal, 'failed', ['last_error' => 'SMTP down']);
    $cookies = loginCookies($admin);

    $all = withAuthCookies($cookies)->getJson('/api/notifications')->assertOk();
    $all->assertJsonCount(3, 'data')->assertJsonPath('summary.sent_today', 1)->assertJsonPath('summary.daily_limit', 300);

    withAuthCookies($cookies)->getJson('/api/notifications?status=failed')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.last_error', 'SMTP down');
    withAuthCookies($cookies)->getJson('/api/notifications?type=assignment.cancelled')
        ->assertOk()->assertJsonCount(0, 'data');
});

it('retries only failed notifications and writes an audit row', function () {
    Queue::fake();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $failed = logRow($marshal, 'failed', ['last_error' => 'boom']);
    $sent = logRow($marshal, 'sent', ['sent_at' => now()]);
    $cookies = loginCookies($admin);

    withAuthCookies($cookies)->postJson("/api/notifications/{$sent->public_code}/retry")->assertUnprocessable();
    withAuthCookies($cookies)->postJson("/api/notifications/{$failed->public_code}/retry")
        ->assertOk()->assertJsonPath('data.status', 'queued');

    expect($failed->fresh()->last_error)->toBeNull();
    Queue::assertPushed(SendNotificationEmail::class, 1);
    expect(AuditLog::query()->where('action', 'notification.retried')->count())->toBe(1);
});

it('keeps the log away from non admins', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $failed = logRow($marshal, 'failed');
    $cookies = loginCookies($marshal);

    withAuthCookies($cookies)->getJson('/api/notifications')->assertForbidden();
    withAuthCookies($cookies)->postJson("/api/notifications/{$failed->public_code}/retry")->assertForbidden();
});

it('shows a person only their own sent notifications', function () {
    $mara = User::factory()->role(RoleCode::Marshal)->create();
    $other = User::factory()->role(RoleCode::Marshal)->create();
    logRow($mara, 'sent', ['sent_at' => now()]);
    logRow($mara, 'failed');
    logRow($other, 'sent', ['sent_at' => now()]);

    withAuthCookies(loginCookies($mara))->getJson('/api/me/notifications')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.type', 'assignment.created');

    $this->withAuthCookies([])->getJson('/api/me/notifications')->assertUnauthorized();
});

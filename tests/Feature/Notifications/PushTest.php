<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Notifications\Contracts\PushTransport;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Enums\Urgency;
use App\Modules\Notifications\Jobs\SendPush;
use App\Modules\Notifications\Models\AlertPreference;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Notifications\Services\AlertSender;
use App\Modules\Personnel\Models\User;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
});

function subscribeBody(string $endpoint = 'https://push.example.test/abc'): array
{
    return ['endpoint' => $endpoint, 'keys' => ['p256dh' => 'pk', 'auth' => 'au'], 'label' => 'Test phone'];
}

function deviceFor(User $user, string $endpoint = 'https://push.example.test/one'): PushSubscription
{
    return PushSubscription::query()->create([
        'user_id' => $user->id, 'endpoint_hash' => PushSubscription::hash($endpoint), 'endpoint' => $endpoint, 'public_key' => 'pk', 'auth_token' => 'au',
    ]);
}

it('maps every event to an urgency level', function () {
    expect(NotificationType::EmergencyReported->urgency())->toBe(Urgency::Urgent)
        ->and(NotificationType::EmergencyReminder->urgency())->toBe(Urgency::Urgent)
        ->and(NotificationType::EmergencyEscalated->urgency())->toBe(Urgency::Urgent)
        ->and(NotificationType::ReportMissed->urgency())->toBe(Urgency::Urgent)
        ->and(NotificationType::ReportOverdue->urgency())->toBe(Urgency::Important)
        ->and(NotificationType::AssignmentCreated->urgency())->toBe(Urgency::Important)
        ->and(NotificationType::ReportReminder->urgency())->toBe(Urgency::Normal)
        ->and(NotificationType::ReminderEvening->urgency())->toBe(Urgency::Normal)
        ->and(NotificationType::ConsentWithdrawn->urgency())->toBe(Urgency::Normal);
});

it('lets a person add and remove their own device and audits it', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $cookies = loginCookies($marshal);

    withAuthCookies($cookies)->postJson('/api/push/subscribe', subscribeBody())->assertCreated();
    withAuthCookies($cookies)->postJson('/api/push/subscribe', subscribeBody())->assertOk();
    expect(PushSubscription::query()->where('user_id', $marshal->id)->count())->toBe(1);

    withAuthCookies($cookies)->getJson('/api/me/push')->assertOk()->assertJsonCount(1, 'data.devices');
    withAuthCookies($cookies)->deleteJson('/api/push/subscribe', ['endpoint' => 'https://push.example.test/abc'])->assertNoContent();
    expect(PushSubscription::query()->count())->toBe(0);
    $this->assertDatabaseHas('audit_logs', ['action' => 'push.enabled']);
    $this->assertDatabaseHas('audit_logs', ['action' => 'push.disabled']);
});

it('refuses removing someone else\'s device and anonymous use', function () {
    $mine = User::factory()->role(RoleCode::Marshal)->create();
    $other = User::factory()->role(RoleCode::Marshal)->create();
    $theirs = deviceFor($other);

    withAuthCookies(loginCookies($mine))->deleteJson("/api/push/devices/{$theirs->id}")->assertForbidden();
    expect(PushSubscription::query()->count())->toBe(1);
    withAuthCookies([])->postJson('/api/push/subscribe', subscribeBody())->assertUnauthorized();
});

it('rejects a non https endpoint', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();

    withAuthCookies(loginCookies($marshal))->postJson('/api/push/subscribe', subscribeBody('http://insecure.example.test/x'))->assertUnprocessable();
});

it('queues a high priority push for an urgent alert, ignoring mute and quiet hours', function () {
    Queue::fake();
    $reviewer = User::factory()->role(RoleCode::Marshal)->create();
    deviceFor($reviewer);
    AlertPreference::query()->create(['user_id' => $reviewer->id, 'push_muted' => true, 'quiet_start' => '00:00', 'quiet_end' => '23:59']);

    app(AlertSender::class)->send($reviewer->id, NotificationType::EmergencyReported);

    Queue::assertPushedOn('high', SendPush::class);
    expect(Notification::query()->where('channel', 'push')->count())->toBe(1);
});

it('queues a normal priority push for an important alert and none for a normal one', function () {
    Queue::fake();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    deviceFor($marshal);

    app(AlertSender::class)->send($marshal->id, NotificationType::AssignmentCreated);
    app(AlertSender::class)->send($marshal->id, NotificationType::ReportReminder);

    Queue::assertPushed(SendPush::class, fn (SendPush $j) => $j->queue === null);
    Queue::assertPushed(SendPush::class, 1);
});

it('skips an important push when muted, in quiet hours, or with no device', function () {
    Queue::fake();
    $muted = User::factory()->role(RoleCode::Marshal)->create();
    deviceFor($muted, 'https://push.example.test/m');
    AlertPreference::query()->create(['user_id' => $muted->id, 'push_muted' => true]);
    $quiet = User::factory()->role(RoleCode::Marshal)->create();
    deviceFor($quiet, 'https://push.example.test/q');
    AlertPreference::query()->create(['user_id' => $quiet->id, 'quiet_start' => '00:00', 'quiet_end' => '23:59']);
    $none = User::factory()->role(RoleCode::Marshal)->create();

    foreach ([$muted, $quiet, $none] as $u) {
        app(AlertSender::class)->send($u->id, NotificationType::AssignmentCreated);
    }

    Queue::assertNotPushed(SendPush::class);
    // The in app alert is still made for everyone.
    expect(Notification::query()->where('channel', 'in_app')->count())->toBe(3);
});

it('handles quiet hours that cross midnight', function () {
    $prefs = new AlertPreference(['quiet_start' => '22:00', 'quiet_end' => '06:00']);

    expect($prefs->quietAt(now()->setTimezone('Asia/Manila')->setTime(23, 0)))->toBeTrue()
        ->and($prefs->quietAt(now()->setTimezone('Asia/Manila')->setTime(5, 59)))->toBeTrue()
        ->and($prefs->quietAt(now()->setTimezone('Asia/Manila')->setTime(12, 0)))->toBeFalse();
});

it('sends to every device, deletes a gone one and logs the push', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $good = deviceFor($user, 'https://push.example.test/good');
    $gone = deviceFor($user, 'https://push.example.test/gone');
    $this->app->bind(PushTransport::class, fn () => new class implements PushTransport
    {
        public function deliver(PushSubscription $subscription, array $payload, bool $urgent): string
        {
            return str_ends_with($subscription->endpoint, 'gone') ? 'gone' : 'sent';
        }
    });

    app(AlertSender::class)->send($user->id, NotificationType::EmergencyReported);

    expect(PushSubscription::query()->pluck('id')->all())->toBe([$good->id])
        ->and(Notification::query()->where('channel', 'push')->value('status'))->toBe('sent');
    expect(PushSubscription::query()->find($gone->id))->toBeNull();
});

it('keeps the in app alert when push breaks', function () {
    $user = User::factory()->role(RoleCode::Marshal)->create();
    deviceFor($user);
    $this->app->bind(PushTransport::class, fn () => new class implements PushTransport
    {
        public function deliver(PushSubscription $subscription, array $payload, bool $urgent): string
        {
            return 'failed';
        }
    });

    try {
        app(AlertSender::class)->send($user->id, NotificationType::EmergencyReported);
    } catch (Throwable) {
        // The sync test queue rethrows after the retries. In production the failure stays in the queue.
    }

    expect(Notification::query()->where('channel', 'in_app')->count())->toBe(1)
        ->and(Notification::query()->where('channel', 'email')->count())->toBe(1);
});

it('stores alert settings for the person only', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();

    withAuthCookies(loginCookies($marshal))->putJson('/api/me/alert-settings', ['push_muted' => true, 'quiet_start' => '22:00', 'quiet_end' => '06:00'])
        ->assertOk()->assertJsonPath('data.quiet_start', '22:00');

    expect(AlertPreference::query()->find($marshal->id)?->push_muted)->toBeTrue();
});

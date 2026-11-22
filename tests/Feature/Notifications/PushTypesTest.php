<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Enums\Urgency;
use App\Modules\Notifications\Jobs\SendPush;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Notifications\Services\AlertSender;
use App\Modules\Personnel\Models\User;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->seed();
});

function typedDevice(User $user): void
{
    PushSubscription::query()->create([
        'user_id' => $user->id, 'endpoint_hash' => PushSubscription::hash('https://push.example.test/t'), 'endpoint' => 'https://push.example.test/t', 'public_key' => 'pk', 'auth_token' => 'au',
    ]);
}

it('queues the right push for every notification type', function (NotificationType $type) {
    Queue::fake();
    $user = User::factory()->role(RoleCode::Marshal)->create();
    typedDevice($user);

    app(AlertSender::class)->send($user->id, $type);

    match ($type->urgency()) {
        Urgency::Urgent => Queue::assertPushedOn('high', SendPush::class),
        Urgency::Important => Queue::assertPushed(SendPush::class, fn (SendPush $j) => $j->queue === null && $j->payload['urgent'] === false),
        Urgency::Normal => Queue::assertNotPushed(SendPush::class),
    };
    // Every type still makes the in app alert and the email.
    expect(Notification::query()->where('channel', 'in_app')->count())->toBe(1)
        ->and(Notification::query()->where('channel', 'email')->count())->toBe(1);
})->with(fn () => NotificationType::cases());

it('keeps push text short and generic for every type', function (NotificationType $type) {
    [$title, $body] = $type->pushText();

    expect(strlen($title))->toBeLessThanOrEqual(40)
        ->and(strlen($body))->toBeLessThanOrEqual(40)
        ->and($title.$body)->not->toMatch('/\d/');
})->with(fn () => NotificationType::cases());

it('marks urgent pushes urgent in the payload', function () {
    Queue::fake();
    $user = User::factory()->role(RoleCode::Marshal)->create();
    typedDevice($user);

    app(AlertSender::class)->send($user->id, NotificationType::EmergencyEscalated);

    Queue::assertPushed(SendPush::class, fn (SendPush $j) => $j->payload['urgent'] === true && $j->payload['tag'] === 'emergency.escalated' && $j->payload['url'] === '/');
});

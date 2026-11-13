<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Personnel\Models\User;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
});

function agreeToLocation(User $user): void
{
    withAuthCookies(loginCookies($user))->postJson('/api/consent/location')->assertNoContent();
}

it('tells every admin once when someone withdraws location consent, with who it was', function () {
    Queue::fake();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $otherAdmin = User::factory()->role(RoleCode::Admin)->create();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    agreeToLocation($marshal);

    withAuthCookies(loginCookies($marshal))->deleteJson('/api/consent/location')->assertNoContent();

    $rows = Notification::query()->where('type', 'consent.withdrawn')->get();
    expect($rows->pluck('user_id')->sort()->values()->all())->toBe(collect([$admin->id, $otherAdmin->id])->sort()->values()->all())
        ->and($rows->pluck('subject_user_id')->unique()->all())->toBe([$marshal->id]);
    Queue::assertPushed(SendNotificationEmail::class, 2);
});

it('does not tell people without location.view, and not the person themselves', function () {
    Queue::fake();
    User::factory()->role(RoleCode::Admin)->create();
    $coordinator = User::factory()->role(RoleCode::Coordinator)->create();
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    agreeToLocation($marshal);

    withAuthCookies(loginCookies($marshal))->deleteJson('/api/consent/location')->assertNoContent();

    $notified = Notification::query()->where('type', 'consent.withdrawn')->pluck('user_id')->all();
    expect($notified)->not->toContain($coordinator->id)->not->toContain($volunteer->id)->not->toContain($marshal->id);
});

it('sends nothing when there was no consent to withdraw', function () {
    Queue::fake();
    User::factory()->role(RoleCode::Admin)->create();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    agreeToLocation($marshal);

    $cookies = loginCookies($marshal);
    withAuthCookies($cookies)->deleteJson('/api/consent/location')->assertNoContent();
    withAuthCookies($cookies)->deleteJson('/api/consent/location')->assertNoContent();
    $neverAgreed = User::factory()->role(RoleCode::Volunteer)->create();
    withAuthCookies(loginCookies($neverAgreed))->deleteJson('/api/consent/location')->assertNoContent();

    expect(Notification::query()->where('type', 'consent.withdrawn')->count())->toBe(1);
});

it('lists the upcoming duties in the email and shows the notice in the admin log', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create(['title' => 'Foundation Day', 'status' => 'published', 'starts_at' => now()->addDay(), 'ends_at' => now()->addDay()->addHours(4)]);
    $req = $event->requirements()->create([
        'duty_type_id' => DutyType::query()->firstOrFail()->id, 'role' => 'marshal', 'headcount' => 1,
        'shift_starts_at' => $event->starts_at, 'shift_ends_at' => $event->ends_at,
    ]);
    Assignment::query()->create(['event_id' => $event->id, 'requirement_id' => $req->id, 'user_id' => $marshal->id, 'duty_type_id' => $req->duty_type_id, 'status' => 'assigned']);
    agreeToLocation($marshal);
    $sent = [];
    app()->instance(MailSender::class, new class($sent) implements MailSender
    {
        public function __construct(public array &$sent) {}

        public function send(string $toEmail, string $toName, string $subject, string $body, ?string $html = null): void
        {
            $this->sent[] = [$toEmail, $body];
        }
    });

    withAuthCookies(loginCookies($marshal))->deleteJson('/api/consent/location')->assertNoContent();

    $notification = Notification::query()->where('type', 'consent.withdrawn')->where('user_id', $admin->id)->firstOrFail();
    expect($notification->status)->toBe('sent')->and($sent[0][1])->toContain($marshal->name)->toContain('Foundation Day');
    $row = withAuthCookies(loginCookies($admin))->getJson('/api/notifications')->assertOk()->json('data.0');
    expect($row['type'])->toBe('consent.withdrawn')->and($row['about'])->toBe($marshal->name);
});

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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
});

function emailReq(Event $event)
{
    return $event->requirements()->create([
        'duty_type_id' => DutyType::query()->firstOrFail()->id, 'role' => 'marshal', 'headcount' => 2,
        'shift_starts_at' => $event->starts_at, 'shift_ends_at' => $event->ends_at,
    ]);
}

it('queues one notification and one email for create, move and cancel', function () {
    Queue::fake();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $marshal = User::factory()->role(RoleCode::Marshal)->create(['email' => 'mara@example.test']);
    $event = Event::factory()->create(['status' => 'published']);
    $one = emailReq($event);
    $two = emailReq($event);
    $cookies = loginCookies($admin);

    $id = withAuthCookies($cookies)->postJson("/api/requirements/{$one->public_code}/assignments", ['user_id' => $marshal->public_code])->assertCreated()->json('data.id');
    withAuthCookies($cookies)->patchJson("/api/assignments/{$id}", ['requirement_id' => $two->public_code])->assertOk();
    withAuthCookies($cookies)->postJson("/api/assignments/{$id}/cancel", ['reason' => 'Event scope reduced'])->assertOk();

    expect(Notification::query()->orderBy('id')->pluck('type')->all())
        ->toBe(['assignment.created', 'assignment.changed', 'assignment.cancelled'])
        ->and(Notification::query()->where('user_id', $marshal->id)->where('status', 'queued')->count())->toBe(3);
    Queue::assertPushed(SendNotificationEmail::class, 3);
});

it('stays quiet on a draft and emails each live assignee once when the event is published', function () {
    Queue::fake();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $dropped = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create(['status' => 'draft']);
    $req = emailReq($event);
    $cookies = loginCookies($admin);

    withAuthCookies($cookies)->postJson("/api/requirements/{$req->public_code}/assignments", ['user_id' => $marshal->public_code])->assertCreated();
    $gone = withAuthCookies($cookies)->postJson("/api/requirements/{$req->public_code}/assignments", ['user_id' => $dropped->public_code])->assertCreated()->json('data.id');
    withAuthCookies($cookies)->postJson("/api/assignments/{$gone}/cancel", ['reason' => 'Changed the plan'])->assertOk();
    expect(Notification::query()->count())->toBe(0);
    Queue::assertNothingPushed();

    withAuthCookies($cookies)->postJson("/api/events/{$event->public_code}/publish")->assertOk();

    expect(Notification::query()->pluck('user_id')->all())->toBe([$marshal->id])
        ->and(Notification::query()->sole()->type)->toBe('assignment.created');
    Queue::assertPushed(SendNotificationEmail::class, 1);
});

it('emails nobody when a draft event is cancelled', function () {
    Queue::fake();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $event = Event::factory()->create(['status' => 'draft']);
    $req = emailReq($event);
    $req->assignments()->create(['event_id' => $event->id, 'user_id' => User::factory()->role(RoleCode::Marshal)->create()->id, 'duty_type_id' => $req->duty_type_id]);

    withAuthCookies(loginCookies($admin))->postJson("/api/events/{$event->public_code}/cancel")->assertOk();

    expect(Notification::query()->count())->toBe(0);
    Queue::assertNothingPushed();
});

it('sends the email with a link and marks the row sent', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create(['email' => 'mara@example.test']);
    $event = Event::factory()->create();
    $a = emailReq($event)->assignments()->create(['event_id' => $event->id, 'user_id' => $marshal->id, 'duty_type_id' => DutyType::query()->firstOrFail()->id]);
    $n = Notification::query()->create(['user_id' => $marshal->id, 'assignment_id' => $a->id, 'type' => 'assignment.created']);
    $sent = [];
    app()->instance(MailSender::class, new class($sent) implements MailSender
    {
        public function __construct(public array &$sent) {}

        public function send(string $toEmail, string $toName, string $subject, string $body, ?string $html = null): void
        {
            $this->sent[] = [$toEmail, $body, $html];
        }
    });

    SendNotificationEmail::dispatchSync($n);

    expect($n->fresh()->status)->toBe('sent')->and($n->fresh()->attempts)->toBe(1)
        ->and($sent[0][0])->toBe('mara@example.test')->and($sent[0][1])->toContain('?assignment='.$a->public_code)
        ->and($sent[0][2])->toContain('You have a new duty')->toContain('?assignment='.$a->public_code)->toContain('cid:zppsu-logo');
});

it('marks the notification failed after the job gives up', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $n = Notification::query()->create(['user_id' => $marshal->id, 'type' => 'assignment.created']);
    $job = new SendNotificationEmail($n);

    expect($job->tries)->toBe(3);
    $job->failed(new RuntimeException('SMTP down'));

    expect($n->fresh()->status)->toBe('failed')->and($n->fresh()->last_error)->toBe('SMTP down');
});

it('queues nothing when a non-admin tries to change an assignment', function () {
    Queue::fake();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create();
    $req = emailReq($event);
    $a = Assignment::query()->create(['event_id' => $event->id, 'requirement_id' => $req->id, 'user_id' => $marshal->id, 'duty_type_id' => $req->duty_type_id]);
    $cookies = loginCookies($marshal);

    withAuthCookies($cookies)->postJson("/api/requirements/{$req->public_code}/assignments", ['user_id' => $marshal->public_code])->assertForbidden();
    withAuthCookies($cookies)->patchJson("/api/assignments/{$a->public_code}", ['requirement_id' => $req->public_code])->assertForbidden();
    withAuthCookies($cookies)->postJson("/api/assignments/{$a->public_code}/cancel", ['reason' => 'No reason really'])->assertForbidden();

    expect(Notification::query()->count())->toBe(0);
    Queue::assertNothingPushed();
});

it('notifies every active assignee once when an event is cancelled', function () {
    Queue::fake();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $one = User::factory()->role(RoleCode::Marshal)->create();
    $two = User::factory()->role(RoleCode::Marshal)->create();
    $gone = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create(['status' => 'published']);
    $req = emailReq($event);
    foreach ([$one, $two] as $u) {
        $req->assignments()->create(['event_id' => $event->id, 'user_id' => $u->id, 'duty_type_id' => $req->duty_type_id]);
    }
    $req->assignments()->create(['event_id' => $event->id, 'user_id' => $gone->id, 'duty_type_id' => $req->duty_type_id, 'status' => 'cancelled']);

    withAuthCookies(loginCookies($admin))->postJson("/api/events/{$event->public_code}/cancel")->assertOk();

    expect(Notification::query()->pluck('user_id')->sort()->values()->all())->toBe(collect([$one->id, $two->id])->sort()->values()->all())
        ->and(Notification::query()->where('type', 'assignment.cancelled')->count())->toBe(2);
    Queue::assertPushed(SendNotificationEmail::class, 2);
});

it('does not notify anyone when a non-admin tries to cancel an event', function () {
    Queue::fake();
    $marshal = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create(['status' => 'published']);
    $req = emailReq($event);
    $req->assignments()->create(['event_id' => $event->id, 'user_id' => $marshal->id, 'duty_type_id' => $req->duty_type_id]);

    withAuthCookies(loginCookies($marshal))->postJson("/api/events/{$event->public_code}/cancel")->assertForbidden();

    expect(Notification::query()->count())->toBe(0);
});

function reminderAssignment(string $startsAt, array $over = []): Assignment
{
    $event = Event::factory()->create(['status' => 'published']);
    $req = $event->requirements()->create([
        'duty_type_id' => DutyType::query()->firstOrFail()->id, 'role' => 'marshal', 'headcount' => 1,
        'shift_starts_at' => $startsAt, 'shift_ends_at' => Carbon::parse($startsAt)->addHours(4),
    ]);

    return $req->assignments()->create(['event_id' => $event->id, 'user_id' => User::factory()->role(RoleCode::Marshal)->create()->id, 'duty_type_id' => $req->duty_type_id, ...$over]);
}

it('sends the evening reminder once after 6 PM Manila time and the hour reminder once in the last hour', function () {
    Queue::fake();
    // Shift 9:00 AM Manila tomorrow = 01:00 UTC. The evening reminder is due at 10:00 UTC today.
    $this->travelTo(Carbon::parse('2026-11-10 09:00:00', 'UTC'));
    $a = reminderAssignment('2026-11-11 01:00:00');

    $this->artisan('notifications:send-reminders')->assertSuccessful();
    expect(Notification::query()->count())->toBe(0);

    $this->travelTo(Carbon::parse('2026-11-10 10:05:00', 'UTC'));
    $this->artisan('notifications:send-reminders');
    $this->artisan('notifications:send-reminders');
    expect(Notification::query()->where('type', 'reminder.evening')->count())->toBe(1);

    $this->travelTo(Carbon::parse('2026-11-11 00:05:00', 'UTC'));
    $this->artisan('notifications:send-reminders');
    $this->artisan('notifications:send-reminders');
    expect(Notification::query()->where('assignment_id', $a->id)->orderBy('id')->pluck('type')->all())->toBe(['reminder.evening', 'reminder.hour']);
});

it('sends no reminder for cancelled, past or cancelled-event assignments', function () {
    Queue::fake();
    $this->travelTo(Carbon::parse('2026-11-11 00:30:00', 'UTC'));
    reminderAssignment('2026-11-11 01:00:00', ['status' => 'cancelled']);
    reminderAssignment('2026-11-10 20:00:00');
    $gone = reminderAssignment('2026-11-11 01:00:00');
    $gone->event->update(['status' => 'cancelled']);

    $this->artisan('notifications:send-reminders')->assertSuccessful();

    expect(Notification::query()->count())->toBe(0);
});

it('skips the evening reminder when the 1 hour reminder is already due', function () {
    Queue::fake();
    $this->travelTo(Carbon::parse('2026-11-11 00:20:00', 'UTC'));
    reminderAssignment('2026-11-11 01:00:00');

    $this->artisan('notifications:send-reminders');

    expect(Notification::query()->pluck('type')->all())->toBe(['reminder.hour']);
});

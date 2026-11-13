<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Events\Models\Event;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Personnel\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;

require_once __DIR__.'/reportHelpers.php';

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:10:00'));
});

/** A slot due at 10:00 for a designated reporter. */
function dueSlot(string $status = 'pending', string $due = '2026-11-16 10:00:00'): SiteReport
{
    $user = User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Mara', 'last_name' => 'Reyes']);
    $assignment = reportAssignment($user);
    designate($user, $assignment->event_id);

    return SiteReport::query()->create(['assignment_id' => $assignment->id, 'due_at' => CarbonImmutable::parse($due), 'status' => $status]);
}

it('marks a slot overdue 15 minutes after it was due, not before', function () {
    $slot = dueSlot();

    Artisan::call('monitoring:mark-overdue-reports');
    expect($slot->fresh()->status->value)->toBe('pending');

    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:15:00'));
    Artisan::call('monitoring:mark-overdue-reports');
    expect($slot->fresh()->status->value)->toBe('overdue')->and($slot->fresh()->overdue_at->format('H:i'))->toBe('10:15');
});

it('leaves sent and future slots alone', function () {
    $sent = dueSlot('submitted');
    $late = dueSlot('late');
    $future = dueSlot(due: '2026-11-16 12:00:00');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:30:00'));

    Artisan::call('monitoring:mark-overdue-reports');

    expect([$sent->fresh()->status->value, $late->fresh()->status->value, $future->fresh()->status->value])->toBe(['submitted', 'late', 'pending']);
    expect(Notification::query()->where('type', 'report.overdue')->count())->toBe(0);
});

it('emails each person who reads reports, once, even if the command runs again', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $coordinator = User::factory()->role(RoleCode::Coordinator)->create();
    $slot = dueSlot();
    $viewer = User::factory()->role(RoleCode::Marshal)->create();
    designate($viewer, $slot->assignment->event_id, permission: 'reports.view');
    $elsewhere = User::factory()->role(RoleCode::Marshal)->create();
    designate($elsewhere, Event::factory()->create()->id, permission: 'reports.view');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:20:00'));

    Artisan::call('monitoring:mark-overdue-reports');
    Artisan::call('monitoring:mark-overdue-reports');

    $notified = Notification::query()->where('type', 'report.overdue')->pluck('user_id')->sort()->values()->all();
    // Every admin (the helper that makes grants also makes one) plus the viewer for this event only.
    $admins = User::query()->whereHas('role', fn ($q) => $q->where('code', 'admin'))->pluck('id')->push($viewer->id)->sort()->values()->all();
    expect($notified)->toBe($admins)->and($notified)->toContain($admin->id)
        ->and($notified)->not->toContain($coordinator->id)->not->toContain($elsewhere->id);
    $row = Notification::query()->where('type', 'report.overdue')->where('user_id', $admin->id)->sole();
    expect($row->site_report_id)->toBe($slot->id)->and($row->assignment_id)->toBe($slot->assignment_id);
});

it('names the reporter, the event and the due time in the email, and shows in the admin log', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $slot = dueSlot();
    $sent = [];
    app()->instance(MailSender::class, new class($sent) implements MailSender
    {
        public function __construct(public array &$sent) {}

        public function send(string $toEmail, string $toName, string $subject, string $body, ?string $html = null): void
        {
            $this->sent[] = [$subject, $body];
        }
    });
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:20:00'));

    Artisan::call('monitoring:mark-overdue-reports');

    expect($sent)->toHaveCount(User::query()->whereHas('role', fn ($q) => $q->where('code', 'admin'))->count())->and($sent[0][0])->toContain('Site report overdue')
        ->and($sent[0][1])->toContain('Mara Reyes')->toContain($slot->assignment->event->title)->toContain('6:00 PM');
    $row = withAuthCookies(loginCookies($admin))->getJson('/api/notifications')->assertOk()->json('data.0');
    expect($row['type'])->toBe('report.overdue')->and($row['event'])->toBe($slot->assignment->event->title)->and($row['about'])->toBe('Mara Reyes');
});

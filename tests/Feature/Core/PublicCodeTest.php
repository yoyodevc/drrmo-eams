<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Access\Models\Role;
use App\Modules\Events\Models\Assignment;
use App\Modules\Events\Models\CampusLocation;
use App\Modules\Events\Models\DutyType;
use App\Modules\Events\Models\Event;
use App\Modules\Information\Models\Memo;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendPush;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Notifications\Services\AlertSender;
use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\EmergencyContact;
use App\Modules\Personnel\Models\User;
use App\Support\PublicCode;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
});

/**
 * One of every record that has a URL, owned by the given admin where ownership matters.
 *
 * @return array<string, mixed>
 */
function everyRecord(User $admin): array
{
    $person = User::factory()->role(RoleCode::Marshal)->create();
    $event = Event::factory()->create(['status' => 'published']);
    $requirement = $event->requirements()->create([
        'duty_type_id' => DutyType::query()->value('id'), 'role' => 'marshal', 'headcount' => 2,
        'shift_starts_at' => $event->starts_at, 'shift_ends_at' => $event->ends_at,
    ]);
    $assignment = Assignment::query()->create([
        'event_id' => $event->id, 'requirement_id' => $requirement->id,
        'user_id' => $admin->id, 'duty_type_id' => $requirement->duty_type_id,
    ]);

    return [
        'event' => $event,
        'requirement' => $requirement,
        'assignment' => $assignment,
        'person' => $person,
        'contact' => EmergencyContact::query()->create(['user_id' => $admin->id, 'name' => 'Test Contact', 'relationship' => 'Friend', 'phone' => '09171234567']),
        'department' => Department::query()->create(['name' => 'Security Office']),
        'dutyType' => DutyType::query()->firstOrFail(),
        'location' => CampusLocation::query()->firstOrFail(),
        'role' => Role::query()->where('code', 'marshal')->firstOrFail(),
        'grant' => PermissionGrant::query()->create([
            'user_id' => $person->id, 'permission_id' => Permission::query()->where('code', 'reports.view')->value('id'),
            'starts_at' => now(), 'ends_at' => now()->addDay(), 'reason' => 'Test grant', 'granted_by' => $admin->id,
        ]),
        'report' => SiteReport::query()->create(['assignment_id' => $assignment->id, 'due_at' => now()->subHour(), 'status' => 'pending']),
        'emergency' => EmergencyReport::query()->create(['assignment_id' => $assignment->id, 'event_id' => $event->id, 'user_id' => $admin->id, 'client_id' => 'abcd1234', 'type' => 'fire', 'status' => 'sent']),
        'notification' => Notification::query()->create(['user_id' => $person->id, 'type' => 'assignment.created', 'channel' => 'email', 'status' => 'failed']),
        'device' => PushSubscription::query()->create(['user_id' => $admin->id, 'endpoint_hash' => str_repeat('a', 64), 'endpoint' => 'https://push.example.test/1', 'public_key' => 'key', 'auth_token' => 'token']),
        'memo' => Memo::factory()->create(),
    ];
}

it('answers 404 to a record number and not to the public code', function (string $key, string $method, string $url, array $body = []) {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $record = everyRecord($admin)[$key];
    $cookies = loginCookies($admin);

    expect($record->public_code)->toMatch('/^[a-z][a-z0-9]{15}$/');
    withAuthCookies($cookies)->json($method, str_replace('{}', (string) $record->getKey(), $url), $body)->assertNotFound();
    expect(withAuthCookies($cookies)->json($method, str_replace('{}', $record->public_code, $url), $body)->status())->not->toBe(404);
})->with([
    'event' => ['event', 'GET', '/api/events/{}'],
    'requirement' => ['requirement', 'GET', '/api/requirements/{}/candidates'],
    'assignment' => ['assignment', 'POST', '/api/me/assignments/{}/acknowledge'],
    'assignment trail' => ['assignment', 'GET', '/api/map/trail/{}'],
    'person' => ['person', 'GET', '/api/people/{}'],
    'direct chat' => ['person', 'GET', '/api/me/chats/{}'],
    'office inbox' => ['person', 'GET', '/api/inbox/{}'],
    'emergency contacts of a person' => ['person', 'GET', '/api/admin/people/{}/emergency-contacts'],
    'emergency contact' => ['contact', 'DELETE', '/api/me/emergency-contacts/{}'],
    'department' => ['department', 'PATCH', '/api/departments/{}', ['name' => 'Security Office']],
    'duty type' => ['dutyType', 'PATCH', '/api/duty-types/{}', ['name' => 'Renamed duty']],
    'campus location' => ['location', 'DELETE', '/api/campus-locations/{}'],
    'role' => ['role', 'GET', '/api/roles/{}'],
    'grant' => ['grant', 'POST', '/api/grants/{}/revoke'],
    'site report' => ['report', 'GET', '/api/reports/{}'],
    'my report slot' => ['report', 'GET', '/api/me/report-slots/{}/emergencies'],
    'emergency' => ['emergency', 'GET', '/api/emergencies/{}'],
    'notification' => ['notification', 'POST', '/api/notifications/{}/retry'],
    'push device' => ['device', 'DELETE', '/api/push/devices/{}'],
    'memo' => ['memo', 'GET', '/api/memos/{}'],
]);

it('refuses record numbers in request bodies and filters', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $records = everyRecord($admin);
    $cookies = loginCookies($admin);
    ['person' => $person, 'requirement' => $requirement, 'event' => $event] = $records;

    withAuthCookies($cookies)->postJson("/api/requirements/{$requirement->public_code}/assignments", ['user_id' => $person->id])
        ->assertUnprocessable()->assertJsonValidationErrors('user_id');
    withAuthCookies($cookies)->postJson('/api/grants', [
        'user_id' => (string) $person->id, 'permission' => 'people.view', 'ends_at' => now()->addDay()->toIso8601String(), 'reason' => 'Number check',
    ])->assertUnprocessable()->assertJsonValidationErrors('user_id');
    withAuthCookies($cookies)->getJson("/api/grants?user={$person->id}")->assertOk()->assertJsonCount(0, 'data');
    withAuthCookies($cookies)->getJson("/api/reports?event_id={$event->id}")->assertOk()->assertJsonCount(0, 'data');
    // A number must not fall back to "every event" on the map.
    withAuthCookies($cookies)->getJson("/api/map/latest?event_id={$event->id}")->assertOk()->assertJsonCount(0, 'data.people');
    withAuthCookies($cookies)->getJson('/api/people?department='.$records['department']->id)->assertUnprocessable();
});

it('sends public codes, never record numbers, to the app', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $records = everyRecord($admin);
    $cookies = loginCookies($admin);

    withAuthCookies($cookies)->getJson('/api/me')->assertJsonPath('data.id', $admin->public_code);
    withAuthCookies($cookies)->getJson('/api/events/'.$records['event']->public_code)
        ->assertJsonPath('data.id', $records['event']->public_code)
        ->assertJsonPath('data.requirements.0.id', $records['requirement']->public_code)
        ->assertJsonPath('data.requirements.0.assignments.0.person.id', $admin->public_code);
    withAuthCookies($cookies)->getJson('/api/me/assignments')
        ->assertJsonPath('data.0.id', $records['assignment']->public_code)
        ->assertJsonPath('data.0.event.id', $records['event']->public_code);
});

it('gives existing rows a code, and a copied row its own', function () {
    $user = User::factory()->create();
    $copy = $user->replicate()->fill(['email' => 'copy@example.test']);
    $copy->save();

    expect($copy->public_code)->not->toBe($user->public_code)
        ->and(Role::query()->whereNull('public_code')->count())->toBe(0)
        ->and(PublicCode::make())->not->toBe(PublicCode::make());
});

it('links a report reminder push to the report by its public code', function () {
    Queue::fake();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $report = everyRecord($admin)['report'];

    app(AlertSender::class)->send($admin->id, NotificationType::ReportDue, ['assignment_id' => $report->assignment_id, 'site_report_id' => $report->id]);

    Queue::assertPushed(SendPush::class, fn (SendPush $job) => $job->payload['url'] === '/me/reports/'.$report->public_code);
});

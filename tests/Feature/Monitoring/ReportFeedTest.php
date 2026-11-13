<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/reportHelpers.php';

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 14:00:00'));
});

/** A report slot of a new event, due at $due, with a status and optional photo. */
function feedReport(string $due, string $status = 'submitted', bool $photo = false, string $summary = 'All calm'): SiteReport
{
    $user = User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Mara', 'last_name' => 'Reyes']);
    $assignment = reportAssignment($user);
    $path = null;
    if ($photo) {
        $path = 'reports/'.fake()->uuid().'.jpg';
        Storage::disk('local')->put($path, 'jpeg-bytes');
    }

    return SiteReport::query()->create([
        'assignment_id' => $assignment->id, 'due_at' => CarbonImmutable::parse($due), 'status' => $status,
        'summary' => $status === 'overdue' || $status === 'pending' ? null : $summary, 'photo_path' => $path, 'photo_name' => $photo ? 'p.jpg' : null,
        'submitted_at' => in_array($status, ['submitted', 'late'], true) ? CarbonImmutable::parse($due) : null,
    ]);
}

it('lists reports newest first with the author, event, place and status', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $old = feedReport('2026-11-16 08:00:00');
    $new = feedReport('2026-11-16 12:00:00', 'late');
    $overdue = feedReport('2026-11-16 13:00:00', 'overdue');
    feedReport('2026-11-16 16:00:00', 'pending'); // not due yet, so not shown

    $rows = withAuthCookies(loginCookies($admin))->getJson('/api/reports')->assertOk()->json('data');

    expect(array_column($rows, 'id'))->toBe([$overdue->id, $new->id, $old->id])
        ->and($rows[0]['status'])->toBe('overdue')->and($rows[1]['status'])->toBe('late')
        ->and($rows[2]['author'])->toBe('Mara Reyes')->and($rows[2]['summary'])->toBe('All calm')
        ->and($rows[2]['event']['title'])->toBe($old->assignment->event->title);
});

it('filters by event, place and date', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $a = feedReport('2026-11-15 08:00:00');
    $b = feedReport('2026-11-16 08:00:00');
    $cookies = loginCookies($admin);

    $ids = fn (string $query) => array_column(withAuthCookies($cookies)->getJson('/api/reports'.$query)->assertOk()->json('data'), 'id');

    expect($ids('?event_id='.$a->assignment->event_id))->toBe([$a->id])
        ->and($ids('?location_id='.$b->assignment->event->campus_location_id))->toContain($b->id)
        // Manila is 8 hours ahead: 08:00 UTC on the 16th is the 16th in Manila.
        ->and($ids('?from=2026-11-16&to=2026-11-16'))->toBe([$b->id])
        ->and($ids('?from=2026-11-15&to=2026-11-15'))->toBe([$a->id]);
    withAuthCookies($cookies)->getJson('/api/reports?from=2026-11-16&to=2026-11-15')->assertUnprocessable();
});

it('serves the photo through the API to people who may read reports', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $with = feedReport('2026-11-16 08:00:00', photo: true);
    $without = feedReport('2026-11-16 09:00:00');
    $cookies = loginCookies($admin);

    withAuthCookies($cookies)->get("/api/reports/{$with->id}/photo")->assertOk();
    withAuthCookies($cookies)->get("/api/reports/{$without->id}/photo")->assertNotFound();
    withAuthCookies($cookies)->getJson("/api/reports/{$with->id}")->assertOk()->assertJsonPath('data.has_photo', true);
});

it('shows a person with an event grant only that event, and refuses the others', function () {
    $mine = feedReport('2026-11-16 08:00:00', photo: true);
    $theirs = feedReport('2026-11-16 09:00:00', photo: true);
    $viewer = User::factory()->role(RoleCode::Coordinator)->create();
    designate($viewer, $mine->assignment->event_id, permission: 'reports.view');
    $cookies = loginCookies($viewer);

    $response = withAuthCookies($cookies)->getJson('/api/reports')->assertOk();
    expect(array_column($response->json('data'), 'id'))->toBe([$mine->id])
        ->and(array_column($response->json('filters.events'), 'id'))->toBe([$mine->assignment->event_id]);

    withAuthCookies($cookies)->getJson("/api/reports/{$mine->id}")->assertOk();
    withAuthCookies($cookies)->getJson("/api/reports/{$theirs->id}")->assertForbidden();
    withAuthCookies($cookies)->get("/api/reports/{$theirs->id}/photo")->assertForbidden();
    withAuthCookies($cookies)->getJson('/api/reports?event_id='.$theirs->assignment->event_id)->assertOk()->assertJsonCount(0, 'data');
});

it('keeps the feed away from everyone else', function () {
    $report = feedReport('2026-11-16 08:00:00', photo: true);
    $reporter = $report->assignment->user;
    designate($reporter, $report->assignment->event_id); // may send reports, not read the feed

    foreach ([$reporter, User::factory()->role(RoleCode::Volunteer)->create(), User::factory()->role(RoleCode::Coordinator)->create()] as $person) {
        $cookies = loginCookies($person);
        withAuthCookies($cookies)->getJson('/api/reports')->assertForbidden();
        withAuthCookies($cookies)->getJson("/api/reports/{$report->id}")->assertForbidden();
        withAuthCookies($cookies)->get("/api/reports/{$report->id}/photo")->assertForbidden();
    }
});

it('needs a sign in', function () {
    $this->getJson('/api/reports')->assertUnauthorized();
    $this->getJson('/api/reports/1')->assertUnauthorized();
});

<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/reportHelpers.php';

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:05:00'));
});

/** A designated reporter with one slot due at 10:00. */
function reporterWithSlot(string $status = 'pending'): array
{
    $user = User::factory()->role(RoleCode::Marshal)->create();
    $assignment = reportAssignment($user);
    designate($user, $assignment->event_id);
    $slot = SiteReport::query()->create(['assignment_id' => $assignment->id, 'due_at' => CarbonImmutable::parse('2026-11-16 10:00:00'), 'status' => $status]);

    return [$user, $slot];
}

it('saves a report on time with a photo kept on the private disk', function () {
    [$user, $slot] = reporterWithSlot();

    $response = withAuthCookies(loginCookies($user))->post("/api/me/report-slots/{$slot->id}", [
        'summary' => 'Gate 2 is clear. Crowd is calm.',
        'photo' => UploadedFile::fake()->image('gate.jpg', 800, 600),
    ], ['Accept' => 'application/json'])->assertOk();

    $response->assertJsonPath('data.status', 'submitted')->assertJsonPath('data.has_photo', true);
    $fresh = $slot->fresh();
    expect($fresh->summary)->toBe('Gate 2 is clear. Crowd is calm.')->and($fresh->photo_name)->toBe('gate.jpg')
        ->and($fresh->photo_path)->toStartWith('reports/')->and($fresh->photo_path)->not->toContain('gate');
    Storage::disk('local')->assertExists($fresh->photo_path);
    expect(AuditLog::query()->where('action', 'report.submitted')->where('actor_id', $user->id)->count())->toBe(1);
});

it('marks a report sent after the grace period, or after it went overdue, as late', function () {
    [$user, $slot] = reporterWithSlot();
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:20:00'));

    withAuthCookies(loginCookies($user))->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'Late but here.'])
        ->assertOk()->assertJsonPath('data.status', 'late');

    [$user2, $overdue] = reporterWithSlot('overdue');
    withAuthCookies(loginCookies($user2))->postJson("/api/me/report-slots/{$overdue->id}", ['summary' => 'After the alert.'])
        ->assertOk()->assertJsonPath('data.status', 'late');
});

it('returns the same report on a double submit and keeps the first one', function () {
    [$user, $slot] = reporterWithSlot();
    $cookies = loginCookies($user);

    $first = withAuthCookies($cookies)->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'First'])->assertOk()->json('data');
    $second = withAuthCookies($cookies)->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'Second try'])->assertOk()->json('data');

    expect($second['id'])->toBe($first['id'])->and($second['summary'])->toBe('First')->and($second['submitted_at'])->toBe($first['submitted_at']);
    expect(SiteReport::query()->count())->toBe(1)->and(AuditLog::query()->where('action', 'report.submitted')->count())->toBe(1);
});

it('only lets the slot owner submit, and only while the grant holds', function () {
    [$owner, $slot] = reporterWithSlot();
    $other = User::factory()->role(RoleCode::Marshal)->create();
    designate($other, $slot->assignment->event_id);
    $admin = User::factory()->role(RoleCode::Admin)->create();

    foreach ([$other, $admin] as $intruder) {
        withAuthCookies(loginCookies($intruder))->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'Not mine'])->assertForbidden();
    }
    expect($slot->fresh()->summary)->toBeNull();

    $owner->grants()->update(['revoked_at' => now()]);
    withAuthCookies(loginCookies($owner))->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'Grant gone'])->assertForbidden();
    $this->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'x'])->assertForbidden();
});

it('needs a sign in', function () {
    [, $slot] = reporterWithSlot();
    $this->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'x'])->assertUnauthorized();
    $this->getJson('/api/me/report-slots')->assertUnauthorized();
});

it('checks the summary and the photo on the server', function () {
    [$user, $slot] = reporterWithSlot();
    $cookies = loginCookies($user);
    $url = "/api/me/report-slots/{$slot->id}";

    withAuthCookies($cookies)->postJson($url, [])->assertUnprocessable()->assertJsonValidationErrors(['summary']);
    withAuthCookies($cookies)->postJson($url, ['summary' => str_repeat('a', 1001)])->assertUnprocessable()->assertJsonValidationErrors(['summary']);
    withAuthCookies($cookies)->post($url, ['summary' => 'ok', 'photo' => UploadedFile::fake()->create('notes.pdf', 50, 'application/pdf')], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['photo']);
    // A script renamed to .jpg is still refused, because the content decides.
    // (A real file, because the fake upload helper guesses the type from the name.)
    $evil = tempnam(sys_get_temp_dir(), 'evil');
    file_put_contents($evil, '<?php echo 1;');
    withAuthCookies($cookies)->post($url, ['summary' => 'ok', 'photo' => new UploadedFile($evil, 'evil.jpg', 'image/jpeg', null, true)], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['photo']);
    withAuthCookies($cookies)->post($url, ['summary' => 'ok', 'photo' => UploadedFile::fake()->create('big.jpg', 9000, 'image/jpeg')], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['photo']);
    withAuthCookies($cookies)->postJson($url, ['summary' => str_repeat('a', 1000)])->assertOk();
});

it('lists only my own slots and serves my photo to me alone', function () {
    [$user, $slot] = reporterWithSlot();
    [, $theirs] = reporterWithSlot();
    $cookies = loginCookies($user);

    $ids = collect(withAuthCookies($cookies)->getJson('/api/me/report-slots')->assertOk()->json('data'))->pluck('id')->all();
    expect($ids)->toBe([$slot->id])->not->toContain($theirs->id);

    withAuthCookies($cookies)->post("/api/me/report-slots/{$slot->id}", ['summary' => 'With photo', 'photo' => UploadedFile::fake()->image('p.png')], ['Accept' => 'application/json'])->assertOk();
    withAuthCookies($cookies)->get("/api/me/report-slots/{$slot->id}/photo")->assertOk()->assertHeader('content-type', 'image/png');
    withAuthCookies($cookies)->get("/api/me/report-slots/{$theirs->id}/photo")->assertForbidden();
    withAuthCookies(loginCookies(User::factory()->role(RoleCode::Volunteer)->create()))->get("/api/me/report-slots/{$slot->id}/photo")->assertForbidden();
});

it('limits report uploads to 6 a minute per person', function () {
    [$user, $slot] = reporterWithSlot();
    $cookies = loginCookies($user);

    foreach (range(1, 6) as $i) {
        withAuthCookies($cookies)->postJson("/api/me/report-slots/{$slot->id}", ['summary' => "try {$i}"])->assertOk();
    }
    withAuthCookies($cookies)->postJson("/api/me/report-slots/{$slot->id}", ['summary' => 'seventh'])->assertStatus(429);
});

<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Information\Models\Memo;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use App\Support\PublicCode;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    Storage::fake('local');
});

it('lets an admin post a memo with text and another with a PDF', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create(['first_name' => 'Ana', 'last_name' => 'Cruz']);
    $cookies = loginCookies($admin);

    withAuthCookies($cookies)->postJson('/api/memos', ['title' => 'Fire Drill Procedure', 'category' => 'procedure', 'body' => 'Walk, do not run.'])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Fire Drill Procedure')
        ->assertJsonPath('data.category_label', 'Procedure')
        ->assertJsonPath('data.posted_by', 'Ana Cruz')
        ->assertJsonPath('data.file', null);

    $id = withAuthCookies($cookies)->post('/api/memos', [
        'title' => 'Evacuation map', 'category' => 'policy',
        'file' => UploadedFile::fake()->create('evac map.pdf', 200, 'application/pdf'),
    ])->assertCreated()->assertJsonPath('data.file.name', 'evac map.pdf')->json('data.id');

    $path = Memo::query()->findOrFail(PublicCode::toId(Memo::class, $id))->file_path;
    expect($path)->toStartWith('memos/')->not->toContain('evac');
    Storage::disk('local')->assertExists($path);
});

it('needs text or a file, and only allows PDF, DOCX, JPG or PNG up to 5 MB', function () {
    $cookies = loginCookies(User::factory()->role(RoleCode::Admin)->create());

    withAuthCookies($cookies)->postJson('/api/memos', ['title' => 'Empty', 'category' => 'other', 'body' => '  '])
        ->assertUnprocessable()->assertJsonValidationErrors('body');
    withAuthCookies($cookies)->post('/api/memos', ['title' => 'Script', 'category' => 'other', 'file' => UploadedFile::fake()->create('run.exe', 10, 'application/x-msdownload')], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors('file');
    withAuthCookies($cookies)->post('/api/memos', ['title' => 'Huge', 'category' => 'other', 'file' => UploadedFile::fake()->create('big.pdf', 5121, 'application/pdf')], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors('file');
    withAuthCookies($cookies)->postJson('/api/memos', ['title' => 'Odd', 'category' => 'gossip', 'body' => 'x'])
        ->assertUnprocessable()->assertJsonValidationErrors('category');

    expect(Memo::query()->count())->toBe(0);

    // Exactly 5 MB is still allowed.
    withAuthCookies($cookies)->post('/api/memos', ['title' => 'Just fits', 'category' => 'other', 'file' => UploadedFile::fake()->create('fits.pdf', 5120, 'application/pdf')], ['Accept' => 'application/json'])
        ->assertCreated();
});

it('lets every role read memos and open the file', function () {
    Storage::disk('local')->put('memos/abc.pdf', '%PDF-1.4 test');
    $memo = Memo::factory()->create(['file_path' => 'memos/abc.pdf', 'file_name' => 'Guide.pdf', 'file_mime' => 'application/pdf', 'file_size' => 13]);

    foreach ([RoleCode::Marshal, RoleCode::Volunteer, RoleCode::Coordinator] as $role) {
        $cookies = loginCookies(User::factory()->role($role)->create());
        withAuthCookies($cookies)->getJson('/api/memos')->assertOk()->assertJsonPath('data.0.id', $memo->public_code)->assertJsonCount(5, 'categories');
        withAuthCookies($cookies)->getJson("/api/memos/{$memo->public_code}")->assertOk()->assertJsonPath('data.body', $memo->body);
        withAuthCookies($cookies)->get("/api/memos/{$memo->public_code}/file")->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
    }
});

it('finds memos by every search word, even a half typed one, and counts matches per category', function () {
    Memo::factory()->create(['title' => 'Fire Drill Procedure', 'category' => 'procedure', 'body' => 'Walk to the field.']);
    Memo::factory()->create(['title' => 'Earthquake drill', 'category' => 'training', 'body' => 'Duck, cover, hold.']);
    Memo::factory()->create(['title' => 'Flood advisory', 'category' => 'advisory', 'body' => 'Avoid the field near the seawall.']);
    $cookies = loginCookies(User::factory()->role(RoleCode::Volunteer)->create());

    $titles = fn (string $query) => withAuthCookies($cookies)->getJson('/api/memos?'.$query)->assertOk()->json('data.*.title');

    expect($titles('q=fire%20dril'))->toBe(['Fire Drill Procedure'])
        ->and($titles('q=field'))->toEqualCanonicalizing(['Fire Drill Procedure', 'Flood advisory'])
        ->and($titles('q=drill&category=training'))->toBe(['Earthquake drill'])
        // One letter is not a search yet, so everything shows.
        ->and($titles('q=f'))->toHaveCount(3);

    $counts = collect(withAuthCookies($cookies)->getJson('/api/memos?q=drill&category=training')->json('categories'))->pluck('count', 'value');
    expect($counts->all())->toBe(['policy' => 0, 'procedure' => 1, 'advisory' => 0, 'training' => 1, 'other' => 0]);
});

it('searches 500 memos in under 300 ms', function () {
    Memo::factory()->count(499)->create();
    Memo::factory()->create(['title' => 'Fire Drill Procedure']);
    $cookies = loginCookies(User::factory()->role(RoleCode::Volunteer)->create());

    $start = microtime(true);
    $titles = withAuthCookies($cookies)->getJson('/api/memos?q=fire%20dril')->assertOk()->json('data.*.title');
    $ms = (microtime(true) - $start) * 1000;

    expect($titles)->toContain('Fire Drill Procedure')->and($ms)->toBeLessThan(300);
});

it('keeps memos away from signed out visitors', function () {
    $memo = Memo::factory()->create();

    $this->getJson('/api/memos')->assertUnauthorized();
    $this->getJson("/api/memos/{$memo->public_code}")->assertUnauthorized();
    $this->getJson("/api/memos/{$memo->public_code}/file")->assertUnauthorized();
});

it('does not let a non-admin post, edit or delete a memo', function () {
    $memo = Memo::factory()->create(['title' => 'Original']);

    foreach ([RoleCode::Marshal, RoleCode::Volunteer, RoleCode::Coordinator] as $role) {
        $cookies = loginCookies(User::factory()->role($role)->create());
        withAuthCookies($cookies)->postJson('/api/memos', ['title' => 'Mine', 'category' => 'other', 'body' => 'x'])->assertForbidden();
        withAuthCookies($cookies)->patchJson("/api/memos/{$memo->public_code}", ['title' => 'Changed', 'category' => 'other', 'body' => 'x'])->assertForbidden();
        withAuthCookies($cookies)->deleteJson("/api/memos/{$memo->public_code}")->assertForbidden();
    }

    expect(Memo::query()->count())->toBe(1)->and($memo->fresh()->title)->toBe('Original');
});

it('replaces a file, removes the old one, and can drop the file when text remains', function () {
    Storage::disk('local')->put('memos/old.pdf', 'old');
    $memo = Memo::factory()->create(['file_path' => 'memos/old.pdf', 'file_name' => 'old.pdf', 'file_mime' => 'application/pdf', 'file_size' => 3]);
    $cookies = loginCookies(User::factory()->role(RoleCode::Admin)->create());

    withAuthCookies($cookies)->post("/api/memos/{$memo->public_code}", [
        '_method' => 'PATCH', 'title' => 'Updated', 'category' => 'advisory', 'body' => $memo->body,
        'file' => UploadedFile::fake()->image('poster.png'),
    ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.file.name', 'poster.png');
    Storage::disk('local')->assertMissing('memos/old.pdf');

    withAuthCookies($cookies)->patchJson("/api/memos/{$memo->public_code}", ['title' => 'Updated', 'category' => 'advisory', 'body' => 'Text stays', 'remove_file' => true])
        ->assertOk()->assertJsonPath('data.file', null);

    // Without text, the last file cannot be removed.
    withAuthCookies($cookies)->patchJson("/api/memos/{$memo->public_code}", ['title' => 'Updated', 'category' => 'advisory', 'body' => '', 'remove_file' => true])
        ->assertUnprocessable()->assertJsonValidationErrors('body');
});

it('soft deletes a memo, writes an audit row, and hides it from readers', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $memo = Memo::factory()->create(['title' => 'Old advisory']);
    $cookies = loginCookies($admin);

    withAuthCookies($cookies)->deleteJson("/api/memos/{$memo->public_code}")->assertNoContent();

    expect(Memo::withTrashed()->find($memo->id)?->trashed())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'memo.deleted')->where('actor_id', $admin->id)->sole()->meta['title'])->toBe('Old advisory');
    withAuthCookies($cookies)->getJson('/api/memos')->assertOk()->assertJsonCount(0, 'data');
    withAuthCookies($cookies)->getJson("/api/memos/{$memo->public_code}")->assertNotFound();
});

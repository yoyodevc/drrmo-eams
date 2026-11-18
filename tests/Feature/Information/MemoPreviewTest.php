<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Information\Contracts\DocumentConverter;
use App\Modules\Information\Jobs\ConvertMemoFile;
use App\Modules\Information\Models\Memo;
use App\Modules\Personnel\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Stands in for LibreOffice. Counts calls and can be told to fail. */
class FakeConverter implements DocumentConverter
{
    public int $calls = 0;

    public function __construct(public bool $on = true, public bool $breaks = false) {}

    public function available(): bool
    {
        return $this->on;
    }

    public function toPdf(string $sourcePath): string
    {
        $this->calls++;
        if ($this->breaks) {
            throw new RuntimeException('LibreOffice could not convert the file.');
        }

        return '%PDF-1.7 copy of '.basename($sourcePath);
    }
}

function useConverter(FakeConverter $converter): FakeConverter
{
    app()->instance(DocumentConverter::class, $converter);

    return $converter;
}

function wordMemo(array $attributes = []): Memo
{
    Storage::disk('local')->put('memos/form.docx', 'PK word bytes');

    return Memo::factory()->create([
        'file_path' => 'memos/form.docx', 'file_name' => 'Entry form.docx', 'file_mime' => DOCX, 'file_size' => 13,
        'preview_status' => 'pending', ...$attributes,
    ]);
}

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
    Storage::fake('local');
});

it('queues a PDF copy when a Word memo is posted and a converter is set up', function () {
    Queue::fake();
    useConverter(new FakeConverter);
    $cookies = loginCookies(User::factory()->role(RoleCode::Admin)->create());

    $id = withAuthCookies($cookies)->post('/api/memos', [
        'title' => 'Sports fest entry form', 'category' => 'other',
        'file' => UploadedFile::fake()->create('entry.docx', 30, DOCX),
    ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.file.preview', 'converting')->json('data.id');

    Queue::assertPushed(ConvertMemoFile::class, fn (ConvertMemoFile $job) => $job->memo->id === $id);
});

it('skips the copy without a converter, and never for PDF files', function () {
    Queue::fake();
    useConverter(new FakeConverter(on: false));
    $cookies = loginCookies(User::factory()->role(RoleCode::Admin)->create());

    withAuthCookies($cookies)->post('/api/memos', [
        'title' => 'Word without LibreOffice', 'category' => 'other',
        'file' => UploadedFile::fake()->create('entry.docx', 30, DOCX),
    ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.file.preview', 'unavailable');

    useConverter(new FakeConverter);
    withAuthCookies($cookies)->post('/api/memos', [
        'title' => 'Already a PDF', 'category' => 'other',
        'file' => UploadedFile::fake()->create('guide.pdf', 30, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.file.preview', null);

    Queue::assertNothingPushed();
});

it('converts the file, then every role can open the PDF copy', function () {
    $converter = useConverter(new FakeConverter);
    $memo = wordMemo();
    $cookies = loginCookies(User::factory()->role(RoleCode::Volunteer)->create());

    withAuthCookies($cookies)->get("/api/memos/{$memo->id}/preview")->assertNotFound();

    ConvertMemoFile::dispatchSync($memo, 'memos/form.docx');
    // A second run finds the ready copy and does nothing.
    ConvertMemoFile::dispatchSync($memo, 'memos/form.docx');

    expect($converter->calls)->toBe(1);
    $memo->refresh();
    expect($memo->preview_status)->toBe('ready')->and($memo->preview_path)->toBe('memos/previews/form.pdf');
    withAuthCookies($cookies)->getJson("/api/memos/{$memo->id}")->assertJsonPath('data.file.preview', 'ready');
    withAuthCookies($cookies)->get("/api/memos/{$memo->id}/preview")
        ->assertOk()->assertHeader('Content-Type', 'application/pdf')->assertHeader('X-Content-Type-Options', 'nosniff');
});

it('keeps the PDF copy away from signed out visitors', function () {
    $memo = wordMemo(['preview_status' => 'ready', 'preview_path' => 'memos/previews/form.pdf']);
    Storage::disk('local')->put('memos/previews/form.pdf', '%PDF-1.7');

    $this->getJson("/api/memos/{$memo->id}/preview")->assertUnauthorized();
});

it('drops a copy made for a file that was replaced while it ran', function () {
    useConverter(new FakeConverter);
    $memo = wordMemo();
    $job = new ConvertMemoFile($memo, 'memos/form.docx');
    $memo->update(['file_path' => 'memos/newer.docx']);
    Storage::disk('local')->put('memos/newer.docx', 'PK newer');

    $job->handle(app(DocumentConverter::class));

    expect($memo->fresh()->preview_status)->toBe('pending');
    Storage::disk('local')->assertMissing('memos/previews/form.pdf');
});

it('marks the copy as failed, so the page falls back to the quick preview', function () {
    $memo = wordMemo();
    $job = new ConvertMemoFile($memo, 'memos/form.docx');

    expect(fn () => $job->handle(useConverter(new FakeConverter(breaks: true))))->toThrow(RuntimeException::class);
    $job->failed(new RuntimeException('LibreOffice could not convert the file.'));

    expect($memo->fresh()->preview_status)->toBe('failed');
    $cookies = loginCookies(User::factory()->role(RoleCode::Admin)->create());
    withAuthCookies($cookies)->getJson("/api/memos/{$memo->id}")->assertJsonPath('data.file.preview', 'unavailable');
});

it('removes the PDF copy with its file', function () {
    $memo = wordMemo(['preview_status' => 'ready', 'preview_path' => 'memos/previews/form.pdf']);
    Storage::disk('local')->put('memos/previews/form.pdf', '%PDF-1.7');
    $cookies = loginCookies(User::factory()->role(RoleCode::Admin)->create());

    withAuthCookies($cookies)->post("/api/memos/{$memo->id}", [
        '_method' => 'PATCH', 'title' => $memo->title, 'category' => 'other', 'body' => 'Text stays.', 'remove_file' => '1',
    ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.file', null);

    Storage::disk('local')->assertMissing('memos/form.docx');
    Storage::disk('local')->assertMissing('memos/previews/form.pdf');
    expect($memo->fresh()->preview_status)->toBeNull();
});

it('queues copies for older Word memos once, from the command', function () {
    Queue::fake();
    useConverter(new FakeConverter);
    $memo = wordMemo(['preview_status' => null]);
    wordMemo(['preview_status' => 'ready', 'preview_path' => 'memos/previews/form.pdf']);

    $this->artisan('memos:convert-previews')->expectsOutput('Queued 1 memo.')->assertSuccessful();
    $this->artisan('memos:convert-previews')->expectsOutput('Queued 0 memos.')->assertSuccessful();

    Queue::assertPushed(ConvertMemoFile::class, 1);
    expect($memo->fresh()->preview_status)->toBe('pending');
});

it('says what to set when the command runs without LibreOffice', function () {
    useConverter(new FakeConverter(on: false));

    $this->artisan('memos:convert-previews')->expectsOutputToContain('LIBREOFFICE_BINARY')->assertFailed();
});

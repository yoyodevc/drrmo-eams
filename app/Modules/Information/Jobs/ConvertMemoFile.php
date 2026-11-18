<?php

declare(strict_types=1);

namespace App\Modules\Information\Jobs;

use App\Modules\Information\Contracts\DocumentConverter;
use App\Modules\Information\Models\Memo;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Makes the PDF copy of a memo's Word file for the preview pane. Tries twice, then the memo page falls
 * back to the quick browser preview. Safe to run twice: a ready copy of the same file is left alone.
 */
class ConvertMemoFile implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    /** @var list<int> */
    public array $backoff = [60];

    public int $timeout = 180;

    /** The file this job was queued for. If the memo has another file by the time it runs, the job stops. */
    public function __construct(public Memo $memo, public string $filePath) {}

    public function handle(DocumentConverter $converter): void
    {
        $memo = Memo::query()->find($this->memo->id);
        if ($memo === null || $memo->file_path !== $this->filePath || ! Memo::isWordFile($memo->file_mime)) {
            return;
        }
        $disk = Storage::disk('local');
        if ($memo->preview_status === 'ready' && $memo->preview_path !== null && $disk->exists($memo->preview_path)) {
            return;
        }

        $pdf = $converter->toPdf($disk->path($this->filePath));
        $path = 'memos/previews/'.pathinfo($this->filePath, PATHINFO_FILENAME).'.pdf';
        $disk->put($path, $pdf);

        // The file may have changed while LibreOffice ran. Then this copy belongs to nobody.
        // toBase() keeps updated_at as it is: making a copy is not an edit to the memo.
        $updated = Memo::query()->whereKey($memo->id)->where('file_path', $this->filePath)->toBase()
            ->update(['preview_path' => $path, 'preview_status' => 'ready']);
        if ($updated === 0) {
            $disk->delete($path);
        }
    }

    public function failed(?Throwable $e): void
    {
        Memo::query()->whereKey($this->memo->id)->where('file_path', $this->filePath)->toBase()
            ->update(['preview_status' => 'failed']);
    }
}

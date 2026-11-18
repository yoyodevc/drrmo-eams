<?php

declare(strict_types=1);

namespace App\Modules\Information\Console;

use App\Modules\Information\Contracts\DocumentConverter;
use App\Modules\Information\Jobs\ConvertMemoFile;
use App\Modules\Information\Models\Memo;
use Illuminate\Console\Command;

/** Queues PDF copies for Word memos that have none yet, for example right after LibreOffice is installed. */
class ConvertMemoPreviews extends Command
{
    protected $signature = 'memos:convert-previews {--retry-failed : Also try again where an earlier conversion failed}';

    protected $description = 'Queue PDF previews for Word memos that do not have one yet';

    public function handle(DocumentConverter $converter): int
    {
        if (! $converter->available()) {
            $this->error('LibreOffice is not set up. Set LIBREOFFICE_BINARY in .env first.');

            return self::FAILURE;
        }

        // Pending and ready rows are skipped, so running this twice queues nothing new.
        $retry = $this->option('retry-failed') ? ['failed'] : [];
        $count = 0;
        Memo::query()->whereNotNull('file_path')->whereIn('file_mime', Memo::WORD_TYPES)
            ->where(fn ($q) => $q->whereNull('preview_status')->orWhereIn('preview_status', $retry))
            ->each(function (Memo $memo) use (&$count) {
                // Quietly and without touching updated_at: queueing a copy is not an edit to the memo.
                $memo->timestamps = false;
                $memo->forceFill(['preview_status' => 'pending'])->saveQuietly();
                ConvertMemoFile::dispatch($memo, (string) $memo->file_path);
                $count++;
            });

        $this->info('Queued '.$count.' '.($count === 1 ? 'memo' : 'memos').'.');

        return self::SUCCESS;
    }
}

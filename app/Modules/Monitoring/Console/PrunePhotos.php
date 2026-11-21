<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Console;

use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Models\SiteReport;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/** Deletes report and emergency photos older than 1 year. The report itself stays, without its photo. */
class PrunePhotos extends Command
{
    public const RETENTION_YEARS = 1;

    protected $signature = 'monitoring:prune-photos';

    protected $description = 'Delete report photos older than 1 year';

    public function handle(): int
    {
        $cutoff = now()->subYears(self::RETENTION_YEARS);
        $total = 0;

        foreach ([SiteReport::class, EmergencyReport::class] as $class) {
            /** @var class-string<Model> $class */
            $class::query()->whereNotNull('photo_path')->where('created_at', '<', $cutoff)->orderBy('id')
                ->each(function (Model $row) use (&$total) {
                    Storage::disk('local')->delete((string) $row->getAttribute('photo_path'));
                    $row->forceFill(['photo_path' => null, 'photo_name' => null])->save();
                    $total++;
                });
        }

        $this->info("Pruned {$total} photos older than {$cutoff->toDateString()}.");

        return self::SUCCESS;
    }
}
